-- ============================================================
-- AUDIT LOGS V2 — Journal d'audit enrichi (preuve légale)
-- ============================================================
-- Enrichissement de la table audit_logs existante :
--   • enum audit_event_type pour typer précisément chaque action
--   • user_id / target_user_id pour distinguer auteur et cible
--   • resolution_id pour relier un log à une résolution
--   • payload JSONB avec snapshot des tantièmes figés dans le temps
--   • metadata JSONB pour IP, user-agent, etc.
-- Colonne vote_type sur votes pour la détection VPC_OVERRIDDEN.
-- 4 nouveaux RPCs atomiques (vote + log dans une transaction).
-- Mise à jour des triggers existants pour utiliser le nouveau schéma.
-- ============================================================


-- ─── 1. ENUM audit_event_type ────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE audit_event_type AS ENUM (
    'AUTH_LOGIN',         -- Connexion d'un copropriétaire
    'AUTH_LOGOUT',        -- Déconnexion
    'POWER_GIVEN',        -- Pouvoir créé / activé
    'POWER_RECOVERED',    -- Pouvoir récupéré (présence physique ou annulation manuelle)
    'POWER_TRANSFERRED',  -- Pouvoir transféré en chaîne
    'VOTE_VPC_SUBMITTED', -- Vote par correspondance (période vote_anticipe)
    'VOTE_LIVE_SUBMITTED',-- Vote en séance (VPC écrasé inclus)
    'VOTE_MANUAL_SYNDIC'  -- Vote à main levée saisi par le syndic pour un tiers réfractaire
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;


-- ─── 2. ENRICHISSEMENT DE LA TABLE audit_logs ───────────────────────────────

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS event_type     audit_event_type,
  -- Auteur de l'action (copro ou syndic) — UUID libre (pas de FK stricte pour
  -- accepter aussi bien coproprietaires.id qu'auth.users.id selon le contexte)
  ADD COLUMN IF NOT EXISTS user_id        UUID,
  -- Cible de l'action (ex : mandataire qui reçoit le pouvoir, copro voté pour)
  ADD COLUMN IF NOT EXISTS target_user_id UUID,
  -- Résolution concernée (vote, pivot de pouvoir…)
  ADD COLUMN IF NOT EXISTS resolution_id  UUID REFERENCES resolutions(id) ON DELETE SET NULL,
  -- Snapshot complet : tantièmes figés + état avant/après
  ADD COLUMN IF NOT EXISTS payload        JSONB NOT NULL DEFAULT '{}',
  -- Données contextuelles : IP, user-agent, etc.
  ADD COLUMN IF NOT EXISTS metadata       JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type)
  WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_resolution ON audit_logs(resolution_id)
  WHERE resolution_id IS NOT NULL;


-- ─── 3. COLONNE vote_type SUR votes ─────────────────────────────────────────
-- Source du vote : indispensable pour détecter VPC_OVERRIDDEN dans submit_live_vote.

ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS vote_type TEXT
    CHECK (vote_type IN ('vpc', 'live', 'manual_syndic'));


-- ─── 4. MISE À JOUR DES TRIGGERS EXISTANTS ──────────────────────────────────
-- Tous les triggers voient maintenant event_type + snapshot tantièmes dans payload.
-- Le champ details reste alimenté pour la rétrocompatibilité avec le code existant.


-- 4a. trg_fn_validate_pouvoir — BEFORE INSERT ON pouvoirs → POWER_GIVEN
CREATE OR REPLACE FUNCTION trg_fn_validate_pouvoir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copropriete_id        UUID;
  v_active_resolution     RECORD;
  v_next_resolution_id    UUID;
  v_total_tantiemes       INTEGER;
  v_mandataire_tantiemes  INTEGER;
  v_mandants_tantiemes    INTEGER;
  v_new_mandant_tantiemes INTEGER;
  v_pouvoir_count         INTEGER;
  v_combined_ratio        NUMERIC;
  v_audit_action          TEXT;
  v_mandant_tantiemes     INTEGER;
BEGIN
  -- === RÈGLE DE TEMPORALITÉ (N+1) ===
  IF NEW.start_resolution_id IS NULL THEN
    SELECT id, ordre INTO v_active_resolution
    FROM resolutions
    WHERE ag_session_id = NEW.ag_session_id AND statut = 'en_cours'
    LIMIT 1;

    IF v_active_resolution.id IS NOT NULL THEN
      v_next_resolution_id    := _next_resolution(NEW.ag_session_id, v_active_resolution.ordre);
      NEW.start_resolution_id := v_next_resolution_id;
    END IF;
  END IF;

  IF NEW.statut IS NULL OR NEW.statut = '' THEN
    NEW.statut := 'active';
  END IF;

  v_audit_action := CASE
    WHEN NEW.start_resolution_id IS NOT NULL THEN 'pouvoir_created_pending'
    ELSE 'pouvoir_created_active'
  END;

  -- === RÈGLE DES QUOTAS (art. 22) ===
  SELECT COUNT(*) INTO v_pouvoir_count
  FROM pouvoirs p
  LEFT JOIN resolutions r_s ON r_s.id = p.start_resolution_id
  LEFT JOIN resolutions r_e ON r_e.id = p.end_resolution_id
  WHERE p.mandataire_id = NEW.mandataire_id
    AND p.ag_session_id = NEW.ag_session_id
    AND p.statut NOT IN ('cancelled', 'archived')
    AND (p.end_resolution_id IS NULL OR r_e.ordre >= COALESCE(
      (SELECT ordre FROM resolutions WHERE id = NEW.start_resolution_id), 0
    ));

  IF v_pouvoir_count >= 3 THEN
    SELECT a.copropriete_id INTO v_copropriete_id
    FROM ag_sessions a WHERE a.id = NEW.ag_session_id;

    SELECT COALESCE(SUM(tantiemes), 0) INTO v_total_tantiemes
    FROM coproprietaires WHERE copropriete_id = v_copropriete_id;

    SELECT COALESCE(tantiemes, 0) INTO v_mandataire_tantiemes
    FROM coproprietaires WHERE id = NEW.mandataire_id;

    SELECT COALESCE(SUM(c.tantiemes), 0) INTO v_mandants_tantiemes
    FROM pouvoirs p
    JOIN coproprietaires c ON c.id = p.mandant_id
    WHERE p.mandataire_id = NEW.mandataire_id
      AND p.ag_session_id = NEW.ag_session_id
      AND p.statut NOT IN ('cancelled', 'archived');

    SELECT COALESCE(tantiemes, 0) INTO v_new_mandant_tantiemes
    FROM coproprietaires WHERE id = NEW.mandant_id;

    v_combined_ratio := CASE
      WHEN v_total_tantiemes > 0
      THEN (v_mandataire_tantiemes + v_mandants_tantiemes + v_new_mandant_tantiemes)::NUMERIC
           / v_total_tantiemes
      ELSE 0
    END;

    IF v_combined_ratio > 0.10 THEN
      RAISE EXCEPTION USING
        MESSAGE = 'POUVOIR_QUOTA_EXCEEDED',
        DETAIL  = format(
          'Le mandataire détient déjà %s pouvoirs et son total de voix atteindrait %s %% (plafond art. 22 : 10 %%).',
          v_pouvoir_count, ROUND(v_combined_ratio * 100, 1)
        ),
        HINT = 'QUOTA_EXCEEDED';
    END IF;
  END IF;

  -- Snapshot tantièmes du mandant au moment de l'action (fige la valeur dans le temps)
  SELECT COALESCE(tantiemes, 0) INTO v_mandant_tantiemes
  FROM coproprietaires WHERE id = NEW.mandant_id;

  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, target_user_id, payload, details
  )
  VALUES (
    NEW.ag_session_id,
    NEW.mandant_id,
    v_audit_action,
    'POWER_GIVEN',
    NEW.mandant_id,
    NEW.mandataire_id,
    jsonb_build_object(
      'mandataire_id',      NEW.mandataire_id,
      'statut',             NEW.statut,
      'start_resolution',   NEW.start_resolution_id,
      'end_resolution',     NEW.end_resolution_id,
      'tantiemes_snapshot', v_mandant_tantiemes   -- tantièmes figés au moment du don
    ),
    -- details conservé pour rétrocompatibilité
    jsonb_build_object(
      'mandataire_id',    NEW.mandataire_id,
      'statut',           NEW.statut,
      'start_resolution', NEW.start_resolution_id,
      'end_resolution',   NEW.end_resolution_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pouvoir ON pouvoirs;
CREATE TRIGGER trg_validate_pouvoir
  BEFORE INSERT ON pouvoirs
  FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_pouvoir();


-- 4b. trg_fn_archive_scheduled_pouvoirs — AFTER UPDATE ON resolutions → POWER_GIVEN / archivage
CREATE OR REPLACE FUNCTION trg_fn_archive_scheduled_pouvoirs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'termine' AND OLD.statut = 'en_cours' THEN

    -- Archiver les scheduled_stop dont c'était la dernière résolution couverte
    WITH archived AS (
      UPDATE pouvoirs
      SET statut     = 'archived',
          deleted_at = now()
      WHERE end_resolution_id = NEW.id
        AND statut = 'scheduled_stop'
      RETURNING id, mandant_id, mandataire_id, ag_session_id
    )
    INSERT INTO audit_logs(
      ag_session_id, coproprietaire_id, action, event_type,
      user_id, target_user_id, resolution_id, payload, details
    )
    SELECT
      a.ag_session_id, a.mandant_id, 'pouvoir_archived', 'POWER_GIVEN',
      a.mandant_id, a.mandataire_id, NEW.id,
      jsonb_build_object(
        'pouvoir_id',         a.id,
        'mandataire_id',      a.mandataire_id,
        'ended_resolution',   NEW.id,
        'tantiemes_snapshot', (SELECT COALESCE(tantiemes, 0) FROM coproprietaires WHERE id = a.mandant_id)
      ),
      jsonb_build_object('pouvoir_id', a.id, 'mandataire_id', a.mandataire_id, 'ended_resolution', NEW.id)
    FROM archived a;

    -- Legacy : activer les pending_activation (ancienne mécanique)
    WITH activated AS (
      UPDATE pouvoirs
      SET statut = 'active', pivot_resolution_id = NULL
      WHERE pivot_resolution_id = NEW.id AND statut = 'pending_activation'
      RETURNING id, mandant_id, mandataire_id, ag_session_id
    )
    INSERT INTO audit_logs(
      ag_session_id, coproprietaire_id, action, event_type,
      user_id, target_user_id, payload, details
    )
    SELECT
      a.ag_session_id, a.mandant_id, 'pouvoir_activated', 'POWER_GIVEN',
      a.mandant_id, a.mandataire_id,
      jsonb_build_object(
        'pouvoir_id',         a.id,
        'mandataire_id',      a.mandataire_id,
        'tantiemes_snapshot', (SELECT COALESCE(tantiemes, 0) FROM coproprietaires WHERE id = a.mandant_id)
      ),
      jsonb_build_object('pouvoir_id', a.id, 'mandataire_id', a.mandataire_id)
    FROM activated a;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_pending_pouvoirs   ON resolutions;
DROP TRIGGER IF EXISTS trg_archive_scheduled_pouvoirs  ON resolutions;
CREATE TRIGGER trg_archive_scheduled_pouvoirs
  AFTER UPDATE OF statut ON resolutions
  FOR EACH ROW EXECUTE FUNCTION trg_fn_archive_scheduled_pouvoirs();


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

  -- 2. Identification du pouvoir à clôturer (CORRECTION DE L'AMBIGUÏTÉ ICI)
  SELECT p.id, p.statut INTO v_active_pouvoir_id, v_active_pouvoir_statut
  FROM pouvoirs p
  LEFT JOIN resolutions r_e ON r_e.id = p.end_resolution_id
  WHERE p.mandant_id    = p_copro_id
    AND p.ag_session_id = v_ag_session_id
    AND p.statut IN ('active', 'scheduled_stop')
    AND (p.end_resolution_id IS NULL OR r_e.ordre >= v_current_ordre)
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- 3. Utilisation de la logique métier (n+1)
  v_next_resolution_id := _next_resolution(v_ag_session_id, v_current_ordre);

  IF v_active_pouvoir_id IS NOT NULL THEN
    IF v_is_vote_active THEN
      -- Si le vote est en cours, le pouvoir s'arrête APRÈS cette résolution
      UPDATE pouvoirs
      SET statut            = 'scheduled_stop',
          end_resolution_id = p_current_resolution_id
      WHERE id = v_active_pouvoir_id;
    ELSE
      -- Sinon, archivage immédiat
      UPDATE pouvoirs
      SET statut            = 'archived',
          end_resolution_id = p_current_resolution_id,
          deleted_at        = now()
      WHERE id = v_active_pouvoir_id;
    END IF;
  END IF;

  -- 4. Enregistrement de la présence
  INSERT INTO attendance_events(
    ag_session_id, coproprietaire_id, event_type,
    resolution_id, effective_from_resolution_id
  ) VALUES (
    v_ag_session_id, p_copro_id, 'arrival',
    p_current_resolution_id,
    CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE p_current_resolution_id END
  );

  -- 5. Snapshot des tantièmes
  SELECT COALESCE(tantiemes, 0) INTO v_copro_tantiemes
  FROM coproprietaires WHERE id = p_copro_id;

  -- 6. Audit Log
  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, resolution_id, payload, details
  )
  VALUES (
    v_ag_session_id, p_copro_id, 'pouvoir_cancelled_presence', 'POWER_RECOVERED',
    p_copro_id,
    p_current_resolution_id,
    jsonb_build_object(
      'pouvoir_id',             v_active_pouvoir_id,
      'current_resolution_id',  p_current_resolution_id,
      'vote_en_cours',           v_is_vote_active,
      'effective_from',          CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE p_current_resolution_id END,
      'tantiemes_snapshot',      v_copro_tantiemes
    ),
    jsonb_build_object(
      'info', 'Récupération de pouvoir suite à présence physique'
    )
  );

  RETURN jsonb_build_object(
    'success',              true,
    'pouvoir_archived_id',  v_active_pouvoir_id,
    'vote_en_cours',        v_is_vote_active,
    'copro_votes_from',     CASE
      WHEN v_is_vote_active THEN v_next_resolution_id
      ELSE p_current_resolution_id
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION handle_power_recovery(UUID, UUID) TO anon, authenticated;


-- 4d. handle_power_redonation — re-délégation après départ → POWER_GIVEN
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

  INSERT INTO attendance_events(
    ag_session_id, coproprietaire_id, event_type,
    resolution_id, effective_from_resolution_id
  ) VALUES (
    v_ag_session_id, p_from_id, 'departure',
    p_current_resolution_id, v_next_resolution_id
  );

  SELECT COALESCE(tantiemes, 0) INTO v_from_tantiemes
  FROM coproprietaires WHERE id = p_from_id;

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
      'tantiemes_snapshot',     v_from_tantiemes   -- snapshot figé
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


-- 4e. create_pouvoir_with_chain — transfert en chaîne → POWER_TRANSFERRED + POWER_GIVEN
CREATE OR REPLACE FUNCTION create_pouvoir_with_chain(
  p_mandant_id    UUID,
  p_mandataire_id UUID,
  p_ag_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_pouvoir_id        UUID;
  v_new_pouvoir_statut    TEXT;
  v_active_resolution_id  UUID;
  v_active_resolution_ord INTEGER;
  v_next_resolution_id    UUID;
  v_chain_row             RECORD;
  v_chained_ids           UUID[]  := ARRAY[]::UUID[];
  v_chained_transfers     JSONB[] := ARRAY[]::JSONB[];
  v_new_chain_id          UUID;
  v_new_chain_statut      TEXT;
  v_new_chain_start       UUID;
  v_chain_tantiemes       INTEGER;
  v_mandant_tantiemes     INTEGER;
BEGIN
  INSERT INTO pouvoirs (mandant_id, mandataire_id, ag_session_id, votes_imposes)
  VALUES (p_mandant_id, p_mandataire_id, p_ag_session_id, '{}')
  RETURNING id, statut INTO v_new_pouvoir_id, v_new_pouvoir_statut;

  SELECT r.id, r.ordre
  INTO v_active_resolution_id, v_active_resolution_ord
  FROM resolutions r
  WHERE r.ag_session_id = p_ag_session_id AND r.statut = 'en_cours'
  LIMIT 1;

  IF v_active_resolution_id IS NOT NULL THEN
    SELECT r.id INTO v_next_resolution_id
    FROM resolutions r
    WHERE r.ag_session_id = p_ag_session_id AND r.ordre > v_active_resolution_ord
    ORDER BY r.ordre LIMIT 1;
  END IF;

  FOR v_chain_row IN
    SELECT p.id, p.mandant_id, p.votes_imposes, p.statut,
           p.start_resolution_id, p.end_resolution_id
    FROM pouvoirs p
    WHERE p.mandataire_id = p_mandant_id
      AND p.ag_session_id = p_ag_session_id
      AND p.statut IN ('active', 'scheduled_stop', 'pending_activation')
  LOOP
    IF v_active_resolution_id IS NOT NULL THEN
      UPDATE pouvoirs
      SET statut = 'scheduled_stop', end_resolution_id = v_active_resolution_id
      WHERE id = v_chain_row.id AND statut NOT IN ('cancelled', 'archived');
    ELSE
      UPDATE pouvoirs
      SET statut = 'archived', deleted_at = now()
      WHERE id = v_chain_row.id AND statut NOT IN ('cancelled', 'archived');
    END IF;

    v_new_chain_start := CASE
      WHEN v_active_resolution_id IS NOT NULL THEN v_next_resolution_id
      ELSE NULL
    END;

    INSERT INTO pouvoirs(mandant_id, mandataire_id, ag_session_id, votes_imposes, start_resolution_id)
    VALUES (v_chain_row.mandant_id, p_mandataire_id, p_ag_session_id, v_chain_row.votes_imposes, v_new_chain_start)
    RETURNING id, statut INTO v_new_chain_id, v_new_chain_statut;

    -- Snapshot tantièmes du mandant enchaîné
    SELECT COALESCE(tantiemes, 0) INTO v_chain_tantiemes
    FROM coproprietaires WHERE id = v_chain_row.mandant_id;

    INSERT INTO audit_logs(
      ag_session_id, coproprietaire_id, action, event_type,
      user_id, target_user_id, payload, details
    )
    VALUES (
      p_ag_session_id, v_chain_row.mandant_id, 'pouvoir_chaine_transfere', 'POWER_TRANSFERRED',
      v_chain_row.mandant_id, p_mandataire_id,
      jsonb_build_object(
        'ancien_pouvoir_id',     v_chain_row.id,
        'nouveau_pouvoir_id',    v_new_chain_id,
        'ancien_mandataire_id',  p_mandant_id,
        'nouveau_mandataire_id', p_mandataire_id,
        'statut_nouveau',        v_new_chain_statut,
        'start_resolution_id',   v_new_chain_start,
        'tantiemes_snapshot',    v_chain_tantiemes   -- snapshot figé
      ),
      jsonb_build_object(
        'ancien_pouvoir_id',      v_chain_row.id,
        'nouveau_pouvoir_id',     v_new_chain_id,
        'ancien_mandataire_id',   p_mandant_id,
        'nouveau_mandataire_id',  p_mandataire_id,
        'statut_nouveau',         v_new_chain_statut,
        'start_resolution_id',    v_new_chain_start
      )
    );

    v_chained_ids       := array_append(v_chained_ids, v_chain_row.mandant_id);
    v_chained_transfers := array_append(v_chained_transfers, jsonb_build_object(
      'mandant_id',        v_chain_row.mandant_id,
      'ancien_pouvoir_id', v_chain_row.id,
      'nouveau_pouvoir_id', v_new_chain_id,
      'statut',            v_new_chain_statut
    ));
  END LOOP;

  -- Snapshot tantièmes du mandant principal
  SELECT COALESCE(tantiemes, 0) INTO v_mandant_tantiemes
  FROM coproprietaires WHERE id = p_mandant_id;

  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, target_user_id, payload, details
  )
  VALUES (
    p_ag_session_id, p_mandant_id, 'pouvoir_avec_chaine', 'POWER_GIVEN',
    p_mandant_id, p_mandataire_id,
    jsonb_build_object(
      'pouvoir_id',         v_new_pouvoir_id,
      'mandataire_id',      p_mandataire_id,
      'statut',             v_new_pouvoir_statut,
      'chained_count',      array_length(v_chained_ids, 1),
      'chained_mandants',   to_jsonb(v_chained_ids),
      'tantiemes_snapshot', v_mandant_tantiemes   -- snapshot figé
    ),
    jsonb_build_object(
      'pouvoir_id',       v_new_pouvoir_id,
      'mandataire_id',    p_mandataire_id,
      'statut',           v_new_pouvoir_statut,
      'chained_count',    array_length(v_chained_ids, 1),
      'chained_mandants', to_jsonb(v_chained_ids)
    )
  );

  RETURN jsonb_build_object(
    'pouvoir_id',        v_new_pouvoir_id,
    'statut',            v_new_pouvoir_statut,
    'chained_count',     COALESCE(array_length(v_chained_ids, 1), 0),
    'chained_transfers', to_jsonb(v_chained_transfers)
  );

EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION create_pouvoir_with_chain(UUID, UUID, UUID) TO anon, authenticated;


-- ─── 5. RPC : log_auth_event ─────────────────────────────────────────────────
-- Enregistre une connexion (AUTH_LOGIN) ou déconnexion (AUTH_LOGOUT).
-- Snapshot des tantièmes inclus pour figer la situation.

CREATE OR REPLACE FUNCTION log_auth_event(
  p_copro_id      UUID,
  p_ag_session_id UUID,
  p_event_type    audit_event_type,   -- 'AUTH_LOGIN' ou 'AUTH_LOGOUT'
  p_metadata      JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tantiemes INTEGER;
BEGIN
  SELECT COALESCE(tantiemes, 0) INTO v_tantiemes
  FROM coproprietaires WHERE id = p_copro_id;

  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, payload, metadata, details
  ) VALUES (
    p_ag_session_id,
    p_copro_id,
    CASE p_event_type
      WHEN 'AUTH_LOGIN'  THEN 'auth_login'
      WHEN 'AUTH_LOGOUT' THEN 'auth_logout'
      ELSE p_event_type::TEXT
    END,
    p_event_type,
    p_copro_id,
    jsonb_build_object('tantiemes_snapshot', v_tantiemes),
    p_metadata,
    jsonb_build_object('tantiemes_snapshot', v_tantiemes)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_auth_event(UUID, UUID, audit_event_type, JSONB) TO anon, authenticated;


-- ─── 6. RPC : submit_vpc_vote ────────────────────────────────────────────────
-- Vote par correspondance (période vote_anticipe).
-- ATOMIQUE : UPSERT vote + INSERT audit_log dans la même transaction.
-- Si le log échoue, l'INSERT vote est annulé (RAISE implicite).

CREATE OR REPLACE FUNCTION submit_vpc_vote(
  p_voter_id      UUID,
  p_resolution_id UUID,
  p_choix         TEXT,
  p_mandant_ids   UUID[] DEFAULT '{}',
  p_metadata      JSONB  DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id     UUID;
  v_voter_tantiemes   INTEGER;
  v_vote_id           UUID;
  v_mandant_id        UUID;
  v_mandant_tantiemes INTEGER;
  v_payload           JSONB;
BEGIN
  SELECT ag_session_id INTO v_ag_session_id
  FROM resolutions WHERE id = p_resolution_id;

  IF v_ag_session_id IS NULL THEN
    RAISE EXCEPTION 'RESOLUTION_NOT_FOUND: %', p_resolution_id;
  END IF;

  -- Snapshot tantièmes figés au moment du vote
  SELECT COALESCE(tantiemes, 0) INTO v_voter_tantiemes
  FROM coproprietaires WHERE id = p_voter_id;

  -- UPSERT vote principal
  INSERT INTO votes(coproprietaire_id, resolution_id, choix, tantiemes_poids, vote_type)
  VALUES (p_voter_id, p_resolution_id, p_choix, v_voter_tantiemes, 'vpc')
  ON CONFLICT (coproprietaire_id, resolution_id)
  DO UPDATE SET
    choix          = EXCLUDED.choix,
    tantiemes_poids = EXCLUDED.tantiemes_poids,
    vote_type      = 'vpc'
  RETURNING id INTO v_vote_id;

  -- Cascade mandants (sans votes_imposes — le frontend ne passe que ceux éligibles)
  FOREACH v_mandant_id IN ARRAY p_mandant_ids LOOP
    SELECT COALESCE(tantiemes, 0) INTO v_mandant_tantiemes
    FROM coproprietaires WHERE id = v_mandant_id;

    INSERT INTO votes(coproprietaire_id, resolution_id, choix, tantiemes_poids, vote_type)
    VALUES (v_mandant_id, p_resolution_id, p_choix, v_mandant_tantiemes, 'vpc')
    ON CONFLICT (coproprietaire_id, resolution_id)
    DO UPDATE SET
      choix          = EXCLUDED.choix,
      tantiemes_poids = EXCLUDED.tantiemes_poids,
      vote_type      = 'vpc';
  END LOOP;

  v_payload := jsonb_build_object(
    'choix',              p_choix,
    'tantiemes_snapshot', v_voter_tantiemes,
    'mandant_count',      COALESCE(array_length(p_mandant_ids, 1), 0)
  );

  -- Log atomique — si cet INSERT échoue, toute la fonction est en erreur → ROLLBACK
  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, resolution_id, payload, metadata, details
  ) VALUES (
    v_ag_session_id, p_voter_id, 'vote_vpc_submitted', 'VOTE_VPC_SUBMITTED',
    p_voter_id, p_resolution_id, v_payload, p_metadata, v_payload
  );

  RETURN jsonb_build_object(
    'success',            true,
    'vote_id',            v_vote_id,
    'tantiemes_snapshot', v_voter_tantiemes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_vpc_vote(UUID, UUID, TEXT, UUID[], JSONB) TO anon, authenticated;


-- ─── 7. RPC : submit_live_vote ───────────────────────────────────────────────
-- Vote en séance (résolution en_cours).
-- Détecte si un VPC existant est écrasé (vpc_overridden = true dans payload).
-- ATOMIQUE : UPSERT vote + INSERT audit_log.

CREATE OR REPLACE FUNCTION submit_live_vote(
  p_voter_id      UUID,
  p_resolution_id UUID,
  p_choix         TEXT,
  p_mandant_ids   UUID[] DEFAULT '{}',
  p_metadata      JSONB  DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id     UUID;
  v_voter_tantiemes   INTEGER;
  v_existing_type     TEXT;
  v_was_vpc           BOOLEAN := FALSE;
  v_vote_id           UUID;
  v_mandant_id        UUID;
  v_mandant_tantiemes INTEGER;
  v_payload           JSONB;
  v_action            TEXT;
BEGIN
  SELECT ag_session_id INTO v_ag_session_id
  FROM resolutions WHERE id = p_resolution_id;

  IF v_ag_session_id IS NULL THEN
    RAISE EXCEPTION 'RESOLUTION_NOT_FOUND: %', p_resolution_id;
  END IF;

  SELECT COALESCE(tantiemes, 0) INTO v_voter_tantiemes
  FROM coproprietaires WHERE id = p_voter_id;

  -- Détection d'un VPC préexistant (source de l'éventuel écrasement)
  SELECT vote_type INTO v_existing_type
  FROM votes
  WHERE coproprietaire_id = p_voter_id AND resolution_id = p_resolution_id;

  IF v_existing_type = 'vpc' THEN
    v_was_vpc := TRUE;
  END IF;

  -- UPSERT vote principal (marque la source 'live')
  INSERT INTO votes(coproprietaire_id, resolution_id, choix, tantiemes_poids, vote_type)
  VALUES (p_voter_id, p_resolution_id, p_choix, v_voter_tantiemes, 'live')
  ON CONFLICT (coproprietaire_id, resolution_id)
  DO UPDATE SET
    choix          = EXCLUDED.choix,
    tantiemes_poids = EXCLUDED.tantiemes_poids,
    vote_type      = 'live'
  RETURNING id INTO v_vote_id;

  -- Cascade mandants
  FOREACH v_mandant_id IN ARRAY p_mandant_ids LOOP
    SELECT COALESCE(tantiemes, 0) INTO v_mandant_tantiemes
    FROM coproprietaires WHERE id = v_mandant_id;

    INSERT INTO votes(coproprietaire_id, resolution_id, choix, tantiemes_poids, vote_type)
    VALUES (v_mandant_id, p_resolution_id, p_choix, v_mandant_tantiemes, 'live')
    ON CONFLICT (coproprietaire_id, resolution_id)
    DO UPDATE SET
      choix          = EXCLUDED.choix,
      tantiemes_poids = EXCLUDED.tantiemes_poids,
      vote_type      = 'live';
  END LOOP;

  v_action  := CASE WHEN v_was_vpc THEN 'vote_live_vpc_override' ELSE 'vote_live_submitted' END;
  v_payload := jsonb_build_object(
    'choix',              p_choix,
    'tantiemes_snapshot', v_voter_tantiemes,
    'mandant_count',      COALESCE(array_length(p_mandant_ids, 1), 0),
    'vpc_overridden',     v_was_vpc
  );

  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, resolution_id, payload, metadata, details
  ) VALUES (
    v_ag_session_id, p_voter_id, v_action, 'VOTE_LIVE_SUBMITTED',
    p_voter_id, p_resolution_id, v_payload, p_metadata, v_payload
  );

  RETURN jsonb_build_object(
    'success',            true,
    'vote_id',            v_vote_id,
    'vpc_overridden',     v_was_vpc,
    'tantiemes_snapshot', v_voter_tantiemes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_live_vote(UUID, UUID, TEXT, UUID[], JSONB) TO anon, authenticated;


-- ─── 8. RPC : submit_manual_syndic_vote ─────────────────────────────────────
-- Vote à main levée : le syndic saisit le vote pour un copropriétaire réfractaire.
-- user_id = syndic (auth.users.id), target_user_id = copro voté pour.
-- ATOMIQUE : UPSERT vote + INSERT audit_log.

CREATE OR REPLACE FUNCTION submit_manual_syndic_vote(
  p_syndic_id     UUID,     -- auth.users.id du syndic auteur de la saisie
  p_copro_id      UUID,     -- coproprietaires.id du copro voté pour
  p_resolution_id UUID,
  p_choix         TEXT,
  p_mandant_ids   UUID[] DEFAULT '{}',
  p_metadata      JSONB  DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id     UUID;
  v_copro_tantiemes   INTEGER;
  v_vote_id           UUID;
  v_mandant_id        UUID;
  v_mandant_tantiemes INTEGER;
  v_payload           JSONB;
BEGIN
  SELECT ag_session_id INTO v_ag_session_id
  FROM resolutions WHERE id = p_resolution_id;

  IF v_ag_session_id IS NULL THEN
    RAISE EXCEPTION 'RESOLUTION_NOT_FOUND: %', p_resolution_id;
  END IF;

  SELECT COALESCE(tantiemes, 0) INTO v_copro_tantiemes
  FROM coproprietaires WHERE id = p_copro_id;

  -- UPSERT vote principal (marque la source 'manual_syndic')
  INSERT INTO votes(coproprietaire_id, resolution_id, choix, tantiemes_poids, vote_type)
  VALUES (p_copro_id, p_resolution_id, p_choix, v_copro_tantiemes, 'manual_syndic')
  ON CONFLICT (coproprietaire_id, resolution_id)
  DO UPDATE SET
    choix          = EXCLUDED.choix,
    tantiemes_poids = EXCLUDED.tantiemes_poids,
    vote_type      = 'manual_syndic'
  RETURNING id INTO v_vote_id;

  -- Cascade mandants (copro est aussi mandataire pour ses propres mandants)
  FOREACH v_mandant_id IN ARRAY p_mandant_ids LOOP
    SELECT COALESCE(tantiemes, 0) INTO v_mandant_tantiemes
    FROM coproprietaires WHERE id = v_mandant_id;

    INSERT INTO votes(coproprietaire_id, resolution_id, choix, tantiemes_poids, vote_type)
    VALUES (v_mandant_id, p_resolution_id, p_choix, v_mandant_tantiemes, 'manual_syndic')
    ON CONFLICT (coproprietaire_id, resolution_id)
    DO UPDATE SET
      choix          = EXCLUDED.choix,
      tantiemes_poids = EXCLUDED.tantiemes_poids,
      vote_type      = 'manual_syndic';
  END LOOP;

  v_payload := jsonb_build_object(
    'choix',              p_choix,
    'tantiemes_snapshot', v_copro_tantiemes,
    'mandant_count',      COALESCE(array_length(p_mandant_ids, 1), 0),
    'saisie_par_syndic',  true
  );

  -- Log : auteur = syndic, cible = copro réfractaire
  INSERT INTO audit_logs(
    ag_session_id, coproprietaire_id, action, event_type,
    user_id, target_user_id, resolution_id, payload, metadata, details
  ) VALUES (
    v_ag_session_id, p_copro_id, 'vote_manual_syndic', 'VOTE_MANUAL_SYNDIC',
    p_syndic_id,    -- user_id = SYNDIC (auteur)
    p_copro_id,     -- target_user_id = COPRO (cible)
    p_resolution_id, v_payload, p_metadata, v_payload
  );

  RETURN jsonb_build_object(
    'success',            true,
    'vote_id',            v_vote_id,
    'tantiemes_snapshot', v_copro_tantiemes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_manual_syndic_vote(UUID, UUID, UUID, TEXT, UUID[], JSONB) TO anon, authenticated;
