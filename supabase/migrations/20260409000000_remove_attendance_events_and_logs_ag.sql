-- ============================================================
-- Migration : suppression de attendance_events et logs_ag
-- Toutes les écritures sont consolidées dans audit_logs.
-- Les fonctions PG qui écrivaient dans attendance_events
-- sont redéfinies pour n'écrire que dans audit_logs.
-- ============================================================


-- ─── 1. Ajout des valeurs d'enum manquantes ──────────────────────────────────
-- Nécessaire pour les inserts frontend (logPresenceEvent).

DO $$ BEGIN
  ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ATTENDANCE_ARRIVED';
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'ATTENDANCE_LEFT';
EXCEPTION WHEN others THEN NULL; END $$;


-- ─── 2. handle_power_recovery — suppression INSERT attendance_events ─────────
-- L'audit est déjà capturé dans audit_logs avec event_type = POWER_RECOVERED.

CREATE OR REPLACE FUNCTION handle_power_recovery(
  p_copro_id              UUID,
  p_current_resolution_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id         UUID;
  v_current_ordre         INTEGER;
  v_next_resolution_id    UUID;
  v_active_pouvoir_id     UUID;
  v_active_pouvoir_statut TEXT;
  v_is_vote_active        BOOLEAN;
  v_copro_tantiemes       INTEGER;
BEGIN
  -- 1. Récupération des infos de la résolution
  SELECT ag_session_id, (statut = 'en_cours'), ordre
  INTO v_ag_session_id, v_is_vote_active, v_current_ordre
  FROM resolutions WHERE id = p_current_resolution_id;

  IF v_ag_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'RESOLUTION_NOT_FOUND');
  END IF;

  -- 2. Identification du pouvoir à clôturer
  SELECT p.id, p.statut INTO v_active_pouvoir_id, v_active_pouvoir_statut
  FROM pouvoirs p
  LEFT JOIN resolutions r_e ON r_e.id = p.end_resolution_id
  WHERE p.mandant_id    = p_copro_id
    AND p.ag_session_id = v_ag_session_id
    AND p.statut IN ('active', 'scheduled_stop')
    AND (p.end_resolution_id IS NULL OR r_e.ordre >= v_current_ordre)
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- 3. Règle N+1
  v_next_resolution_id := _next_resolution(v_ag_session_id, v_current_ordre);

  IF v_active_pouvoir_id IS NOT NULL THEN
    IF v_is_vote_active THEN
      UPDATE pouvoirs
      SET statut            = 'scheduled_stop',
          end_resolution_id = p_current_resolution_id
      WHERE id = v_active_pouvoir_id;
    ELSE
      UPDATE pouvoirs
      SET statut            = 'archived',
          end_resolution_id = p_current_resolution_id,
          deleted_at        = now()
      WHERE id = v_active_pouvoir_id;
    END IF;
  END IF;

  -- 4. Snapshot des tantièmes
  SELECT COALESCE(tantiemes, 0) INTO v_copro_tantiemes
  FROM coproprietaires WHERE id = p_copro_id;

  -- 5. Audit log (remplace l'ancien INSERT INTO attendance_events)
  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, resolution_id, payload, details
  )
  VALUES (
    v_ag_session_id, p_copro_id, 'pouvoir_cancelled_presence', 'POWER_RECOVERED',
    p_copro_id,
    p_current_resolution_id,
    jsonb_build_object(
      'pouvoir_id',            v_active_pouvoir_id,
      'current_resolution_id', p_current_resolution_id,
      'vote_en_cours',         v_is_vote_active,
      'effective_from',        CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE p_current_resolution_id END,
      'tantiemes_snapshot',    v_copro_tantiemes
    ),
    jsonb_build_object(
      'info', 'Récupération de pouvoir suite à présence physique'
    )
  );

  RETURN jsonb_build_object(
    'success',             true,
    'pouvoir_archived_id', v_active_pouvoir_id,
    'vote_en_cours',       v_is_vote_active,
    'copro_votes_from',    CASE
      WHEN v_is_vote_active THEN v_next_resolution_id
      ELSE p_current_resolution_id
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION handle_power_recovery(UUID, UUID) TO anon, authenticated;


-- ─── 3. handle_power_redonation — suppression INSERT attendance_events ────────
-- L'audit est déjà capturé dans audit_logs avec event_type = POWER_GIVEN.

CREATE OR REPLACE FUNCTION handle_power_redonation(
  p_from_id               UUID,
  p_to_id                 UUID,
  p_current_resolution_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id      UUID;
  v_current_ordre      INTEGER;
  v_is_vote_active     BOOLEAN;
  v_next_resolution_id UUID;
  v_quota_check        JSONB;
  v_new_pouvoir_id     UUID;
  v_from_tantiemes     INTEGER;
BEGIN
  IF p_from_id = p_to_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'SELF_DELEGATION');
  END IF;

  SELECT ag_session_id, statut = 'en_cours', ordre
  INTO v_ag_session_id, v_is_vote_active, v_current_ordre
  FROM resolutions WHERE id = p_current_resolution_id;

  v_next_resolution_id := _next_resolution(v_ag_session_id, v_current_ordre);

  v_quota_check := check_pouvoir_quota_rpc(p_to_id, v_ag_session_id, p_from_id);
  IF NOT (v_quota_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason',  'QUOTA_EXCEEDED',
      'detail',  v_quota_check->>'detail'
    );
  END IF;

  INSERT INTO pouvoirs(
    mandant_id, mandataire_id, ag_session_id,
    votes_imposes, statut, start_resolution_id
  )
  VALUES (
    p_from_id, p_to_id, v_ag_session_id,
    '{}', 'active',
    CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END
  )
  RETURNING id INTO v_new_pouvoir_id;

  SELECT COALESCE(tantiemes, 0) INTO v_from_tantiemes
  FROM coproprietaires WHERE id = p_from_id;

  -- Audit log (remplace l'ancien INSERT INTO attendance_events)
  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, target_user_id, payload, details
  )
  VALUES (
    v_ag_session_id, p_from_id, 'pouvoir_created_active', 'POWER_GIVEN',
    p_from_id, p_to_id,
    jsonb_build_object(
      'new_pouvoir_id',         v_new_pouvoir_id,
      'mandataire_id',          p_to_id,
      'current_resolution_id',  p_current_resolution_id,
      'start_resolution_id',    CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END,
      'n_plus_1_applied',       v_is_vote_active,
      'tantiemes_snapshot',     v_from_tantiemes
    ),
    jsonb_build_object(
      'new_pouvoir_id',        v_new_pouvoir_id,
      'mandataire_id',         p_to_id,
      'current_resolution_id', p_current_resolution_id,
      'start_resolution_id',   CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END,
      'n_plus_1_applied',      v_is_vote_active
    )
  );

  RETURN jsonb_build_object(
    'success',            true,
    'pouvoir_id',         v_new_pouvoir_id,
    'effective_from_id',  CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION handle_power_redonation(UUID, UUID, UUID) TO anon, authenticated;


-- ─── 4. Suppression des tables legacy ────────────────────────────────────────

-- Policies RLS
DROP POLICY IF EXISTS "allow_insert_logs_ag"         ON logs_ag;
DROP POLICY IF EXISTS "allow_select_logs_ag"         ON logs_ag;
DROP POLICY IF EXISTS "logs_ag_insert"               ON logs_ag;
DROP POLICY IF EXISTS "logs_ag_select"               ON logs_ag;
DROP POLICY IF EXISTS "attendance_select"            ON attendance_events;
DROP POLICY IF EXISTS "attendance_insert"            ON attendance_events;
DROP POLICY IF EXISTS "allow_insert_attendance"      ON attendance_events;
DROP POLICY IF EXISTS "allow_select_attendance"      ON attendance_events;

-- Tables (CASCADE pour les éventuelles FK)
DROP TABLE IF EXISTS logs_ag           CASCADE;
DROP TABLE IF EXISTS attendance_events CASCADE;
