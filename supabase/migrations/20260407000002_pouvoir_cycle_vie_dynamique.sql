-- ============================================================
-- CYCLE DE VIE DYNAMIQUE DES POUVOIRS
-- Scénario : A → B → A arrive (Vote 3) → A repart (Vote 6) → A → B
-- Chaque pouvoir est un intervalle temporel [start_ordre, end_ordre]
-- (bornes INCLUSIVES). NULL = ouvert de ce côté.
-- Invariant fondamental : on ne supprime JAMAIS de ligne.
-- ============================================================

-- ─── 1. EXTENSION DE LA TABLE POUVOIRS ──────────────────────────────────────

-- 1a. Étendre le CHECK statut (sans DROP : PostgreSQL ne permet pas ALTER CHECK
--     inline, donc on supprime l'ancienne contrainte et on la recrée).
DO $$
BEGIN
  -- Cherche le nom de la contrainte statut générée automatiquement
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pouvoirs'::regclass
      AND contype = 'c'
      AND conname ILIKE '%statut%'
  ) THEN
    EXECUTE 'ALTER TABLE pouvoirs DROP CONSTRAINT ' ||
      (SELECT conname FROM pg_constraint
       WHERE conrelid = 'pouvoirs'::regclass AND contype = 'c' AND conname ILIKE '%statut%'
       LIMIT 1);
  END IF;
END;
$$;

ALTER TABLE pouvoirs ADD CONSTRAINT pouvoirs_statut_check
  CHECK (statut IN (
    'active',             -- actif, couvre une plage [start, end] (end NULL = encore actif)
    'pending_activation', -- legacy (remplacé par start_resolution_id, conservé pour compat)
    'scheduled_stop',     -- actif jusqu'à end_resolution_id inclus, s'arrêtera après
    'archived',           -- terminé naturellement (end_resolution_id passé)
    'cancelled'           -- révoqué manuellement sans fin de plage
  ));

-- 1b. Nouvelles colonnes temporelles
ALTER TABLE pouvoirs
  ADD COLUMN IF NOT EXISTS start_resolution_id UUID
    REFERENCES resolutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS end_resolution_id UUID
    REFERENCES resolutions(id) ON DELETE SET NULL;

COMMENT ON COLUMN pouvoirs.start_resolution_id IS
  'Première résolution (inclusive) à partir de laquelle ce pouvoir est actif. NULL = depuis le début de l''AG.';
COMMENT ON COLUMN pouvoirs.end_resolution_id IS
  'Dernière résolution (inclusive) couverte par ce pouvoir. NULL = toujours actif.';

CREATE INDEX IF NOT EXISTS idx_pouvoirs_start_res ON pouvoirs(start_resolution_id)
  WHERE start_resolution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pouvoirs_end_res ON pouvoirs(end_resolution_id)
  WHERE end_resolution_id IS NOT NULL;

-- 1c. Mettre à jour la contrainte UNIQUE partielle.
--     Seuls les pouvoirs 'active' et 'scheduled_stop' doivent être uniques
--     par (mandant, AG). Les archived/cancelled sont des traces historiques.
DROP INDEX IF EXISTS pouvoirs_mandant_ag_active_unique;
CREATE UNIQUE INDEX IF NOT EXISTS pouvoirs_mandant_ag_live_unique
  ON pouvoirs(mandant_id, ag_session_id)
  WHERE statut IN ('active', 'scheduled_stop');


-- ─── 2. TABLE ATTENDANCE_EVENTS ─────────────────────────────────────────────
-- Journal immuable des arrivées / départs en cours de séance.

CREATE TABLE IF NOT EXISTS attendance_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ag_session_id     UUID        NOT NULL REFERENCES ag_sessions(id) ON DELETE CASCADE,
  coproprietaire_id UUID        NOT NULL REFERENCES coproprietaires(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL CHECK (event_type IN ('arrival', 'departure')),
  resolution_id     UUID        REFERENCES resolutions(id) ON DELETE SET NULL,
  -- résolution à partir de laquelle l'événement prend effet (N+1)
  effective_from_resolution_id UUID REFERENCES resolutions(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select" ON attendance_events FOR SELECT USING (true);
CREATE POLICY "attendance_insert" ON attendance_events FOR INSERT WITH CHECK (true);


-- ─── 3. FONCTION UTILITAIRE INTERNE : trouver la résolution suivante ─────────

CREATE OR REPLACE FUNCTION _next_resolution(p_ag_session_id UUID, p_current_ordre INTEGER)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM resolutions
  WHERE ag_session_id = p_ag_session_id
    AND ordre > p_current_ordre
  ORDER BY ordre ASC
  LIMIT 1;
$$;


-- ─── 4. FONCTION get_voting_weight ──────────────────────────────────────────
-- Calcule le poids de vote réel (propres tantièmes + mandants actifs)
-- d'un utilisateur POUR UNE RÉSOLUTION PRÉCISE.
-- Retourne un objet JSON riche consommable par le frontend.

CREATE OR REPLACE FUNCTION get_voting_weight(
  p_user_id       UUID,
  p_resolution_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own_tantiemes    INTEGER;
  v_resolution_ordre INTEGER;
  v_ag_session_id    UUID;
  v_mandants_sum     INTEGER := 0;
  v_mandants_json    JSONB   := '[]'::JSONB;
BEGIN
  SELECT tantiemes INTO v_own_tantiemes
  FROM coproprietaires WHERE id = p_user_id;

  SELECT ordre, ag_session_id INTO v_resolution_ordre, v_ag_session_id
  FROM resolutions WHERE id = p_resolution_id;

  -- Mandants dont le pouvoir couvre cette résolution (intervalle inclusif)
  SELECT
    COALESCE(SUM(c.tantiemes), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id',        c.id,
      'prenom',    c.prenom,
      'nom',       c.nom,
      'tantiemes', c.tantiemes,
      'statut',    p.statut
    ) ORDER BY c.nom), '[]'::JSONB)
  INTO v_mandants_sum, v_mandants_json
  FROM pouvoirs p
  JOIN coproprietaires c ON c.id = p.mandant_id
  LEFT JOIN resolutions r_s ON r_s.id = p.start_resolution_id
  LEFT JOIN resolutions r_e ON r_e.id = p.end_resolution_id
  WHERE p.mandataire_id   = p_user_id
    AND p.ag_session_id   = v_ag_session_id
    AND p.statut NOT IN ('cancelled', 'pending_activation')
    -- Borne gauche (inclusive) : NULL = depuis le début
    AND (p.start_resolution_id IS NULL OR r_s.ordre <= v_resolution_ordre)
    -- Borne droite (inclusive) : NULL = toujours actif
    AND (p.end_resolution_id IS NULL OR v_resolution_ordre <= r_e.ordre);

  RETURN jsonb_build_object(
    'total_tantiemes',  v_own_tantiemes + v_mandants_sum,
    'own_tantiemes',    v_own_tantiemes,
    'mandants_tantiemes', v_mandants_sum,
    'mandants_count',   jsonb_array_length(v_mandants_json),
    'mandants',         v_mandants_json,
    'resolution_id',    p_resolution_id,
    'resolution_ordre', v_resolution_ordre
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_voting_weight(UUID, UUID) TO anon, authenticated;


-- ─── 5. FONCTION handle_power_recovery ──────────────────────────────────────
-- Appelée quand un copropriétaire ARRIVE en cours de séance.
-- Règle N+1 : le pouvoir actuel reste valide pour la résolution en cours (vote N).
--              Le copropriétaire reprend ses droits à partir de N+1.
-- ATOMIQUE : tout ou rien (plpgsql = transaction implicite).

CREATE OR REPLACE FUNCTION handle_power_recovery(
  p_copro_id             UUID,
  p_current_resolution_id UUID  -- résolution en cours au moment de l'arrivée
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id        UUID;
  v_current_ordre        INTEGER;
  v_next_resolution_id   UUID;
  v_active_pouvoir_id    UUID;
  v_active_pouvoir_statut TEXT;
  v_is_vote_active        BOOLEAN;
BEGIN
  SELECT ag_session_id, statut = 'en_cours', ordre
  INTO v_ag_session_id, v_is_vote_active, v_current_ordre
  FROM resolutions WHERE id = p_current_resolution_id;

  IF v_ag_session_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'RESOLUTION_NOT_FOUND');
  END IF;

  -- Chercher la résolution suivante (pour le N+1)
  v_next_resolution_id := _next_resolution(v_ag_session_id, v_current_ordre);

  -- Trouver le pouvoir vivant de ce copro (actif ou scheduled_stop non encore archivé)
  SELECT id, statut INTO v_active_pouvoir_id, v_active_pouvoir_statut
  FROM pouvoirs p
  LEFT JOIN resolutions r_e ON r_e.id = p.end_resolution_id
  WHERE p.mandant_id    = p_copro_id
    AND p.ag_session_id = v_ag_session_id
    AND p.statut IN ('active', 'scheduled_stop')
    -- Ne traiter que les pouvoirs qui couvrent encore la résolution courante
    AND (p.end_resolution_id IS NULL OR r_e.ordre >= v_current_ordre)
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_active_pouvoir_id IS NOT NULL THEN
    IF v_is_vote_active THEN
      -- Un vote est en cours : le pouvoir reste valide pour CE vote (N+1 rule)
      -- end_resolution_id = vote courant (inclusive = dernier vote couvert par le mandataire)
      UPDATE pouvoirs
      SET statut            = 'scheduled_stop',
          end_resolution_id = p_current_resolution_id
      WHERE id = v_active_pouvoir_id;
    ELSE
      -- Aucun vote actif : le pouvoir s'arrête immédiatement (avant N)
      UPDATE pouvoirs
      SET statut            = 'archived',
          end_resolution_id = p_current_resolution_id,
          deleted_at        = now()
      WHERE id = v_active_pouvoir_id;
    END IF;
  END IF;

  -- Journal de présence
  INSERT INTO attendance_events(
    ag_session_id, coproprietaire_id, event_type,
    resolution_id, effective_from_resolution_id
  ) VALUES (
    v_ag_session_id, p_copro_id, 'arrival',
    p_current_resolution_id,
    CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE p_current_resolution_id END
  );

  -- Audit log
  INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
  VALUES (v_ag_session_id, p_copro_id, 'pouvoir_cancelled_presence', jsonb_build_object(
    'pouvoir_id',              v_active_pouvoir_id,
    'current_resolution_id',  p_current_resolution_id,
    'vote_en_cours',           v_is_vote_active,
    'effective_from',          CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE p_current_resolution_id END,
    'n_plus_1_applied',        v_is_vote_active
  ));

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


-- ─── 6. FONCTION handle_power_redonation ────────────────────────────────────
-- Appelée quand un copropriétaire REPART et re-délègue son pouvoir.
-- Règle N+1 : le nouveau pouvoir prend effet à partir de la résolution N+1.
-- Vérifie les quotas art. 22 avant d'insérer.
-- ATOMIQUE.

CREATE OR REPLACE FUNCTION handle_power_redonation(
  p_from_id              UUID,   -- mandant qui re-délègue
  p_to_id                UUID,   -- mandataire qui reçoit
  p_current_resolution_id UUID   -- résolution en cours au moment du départ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id       UUID;
  v_current_ordre       INTEGER;
  v_is_vote_active      BOOLEAN;
  v_next_resolution_id  UUID;
  v_quota_check         JSONB;
  v_new_pouvoir_id      UUID;
BEGIN
  IF p_from_id = p_to_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'SELF_DELEGATION');
  END IF;

  SELECT ag_session_id, statut = 'en_cours', ordre
  INTO v_ag_session_id, v_is_vote_active, v_current_ordre
  FROM resolutions WHERE id = p_current_resolution_id;

  -- Résolution N+1
  v_next_resolution_id := _next_resolution(v_ag_session_id, v_current_ordre);

  -- Vérification quota art. 22 — au moment T présent
  v_quota_check := check_pouvoir_quota_rpc(p_to_id, v_ag_session_id, p_from_id);
  IF NOT (v_quota_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason',  'QUOTA_EXCEEDED',
      'detail',  v_quota_check->>'detail'
    );
  END IF;

  -- Insertion du nouveau pouvoir.
  -- Le trigger trg_validate_pouvoir s'exécutera, MAIS :
  --   - on lui passe start_resolution_id déjà fixé → il n'overridera pas
  --   - la vérification quota est donc doublée (sécurité DB)
  INSERT INTO pouvoirs(
    mandant_id, mandataire_id, ag_session_id,
    votes_imposes, statut, start_resolution_id
  )
  VALUES (
    p_from_id, p_to_id, v_ag_session_id,
    '{}',
    'active',
    -- N+1 si vote actif, sinon effectif immédiatement
    CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END
  )
  RETURNING id INTO v_new_pouvoir_id;

  -- Journal de présence (départ)
  INSERT INTO attendance_events(
    ag_session_id, coproprietaire_id, event_type,
    resolution_id, effective_from_resolution_id
  ) VALUES (
    v_ag_session_id, p_from_id, 'departure',
    p_current_resolution_id, v_next_resolution_id
  );

  -- Audit log
  INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
  VALUES (v_ag_session_id, p_from_id, 'pouvoir_created_active', jsonb_build_object(
    'new_pouvoir_id',          v_new_pouvoir_id,
    'mandataire_id',           p_to_id,
    'current_resolution_id',  p_current_resolution_id,
    'start_resolution_id',     CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END,
    'n_plus_1_applied',        v_is_vote_active
  ));

  RETURN jsonb_build_object(
    'success',            true,
    'pouvoir_id',         v_new_pouvoir_id,
    'effective_from_id',  CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION handle_power_redonation(UUID, UUID, UUID) TO anon, authenticated;


-- ─── 7. MISE À JOUR DU TRIGGER D'INSERTION ──────────────────────────────────
-- Si start_resolution_id est déjà renseigné (cas handle_power_redonation),
-- on ne le réécrit pas. Sinon, on applique la règle N+1.
-- Le statut 'pending_activation' est remplacé par start_resolution_id.

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
BEGIN
  -- === RÈGLE DE TEMPORALITÉ ===
  -- Seulement si le caller n'a pas déjà fixé start_resolution_id
  IF NEW.start_resolution_id IS NULL THEN
    SELECT id, ordre INTO v_active_resolution
    FROM resolutions
    WHERE ag_session_id = NEW.ag_session_id AND statut = 'en_cours'
    LIMIT 1;

    IF v_active_resolution.id IS NOT NULL THEN
      v_next_resolution_id := _next_resolution(NEW.ag_session_id, v_active_resolution.ordre);
      NEW.start_resolution_id := v_next_resolution_id;
      -- On garde 'active' : c'est start_resolution_id qui gère la temporalité
    END IF;
  END IF;

  -- Statut par défaut si non fourni
  IF NEW.statut IS NULL OR NEW.statut = '' THEN
    NEW.statut := 'active';
  END IF;

  -- Action audit
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
    -- Pour le quota, on compte les pouvoirs dont la plage couvre maintenant ou le futur
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

  -- Audit
  INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
  VALUES (NEW.ag_session_id, NEW.mandant_id, v_audit_action, jsonb_build_object(
    'mandataire_id',     NEW.mandataire_id,
    'statut',            NEW.statut,
    'start_resolution',  NEW.start_resolution_id,
    'end_resolution',    NEW.end_resolution_id
  ));

  RETURN NEW;
END;
$$;

-- Recréer le trigger (la fonction vient d'être mise à jour)
DROP TRIGGER IF EXISTS trg_validate_pouvoir ON pouvoirs;
CREATE TRIGGER trg_validate_pouvoir
  BEFORE INSERT ON pouvoirs
  FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_pouvoir();


-- ─── 8. TRIGGER : scheduled_stop → archived quand résolution se clôture ──────

CREATE OR REPLACE FUNCTION trg_fn_archive_scheduled_pouvoirs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'termine' AND OLD.statut = 'en_cours' THEN
    -- Archiver les pouvoirs dont c'était la dernière résolution couverte
    WITH archived AS (
      UPDATE pouvoirs
      SET statut     = 'archived',
          deleted_at = now()
      WHERE end_resolution_id = NEW.id
        AND statut = 'scheduled_stop'
      RETURNING id, mandant_id, mandataire_id, ag_session_id
    )
    INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
    SELECT a.ag_session_id, a.mandant_id, 'pouvoir_activated',
      jsonb_build_object(
        'pouvoir_id',        a.id,
        'mandataire_id',     a.mandataire_id,
        'ended_resolution',  NEW.id
      )
    FROM archived a;

    -- Legacy : activer les pending_activation (ancienne mécanique)
    WITH activated AS (
      UPDATE pouvoirs
      SET statut = 'active', pivot_resolution_id = NULL
      WHERE pivot_resolution_id = NEW.id AND statut = 'pending_activation'
      RETURNING id, mandant_id, mandataire_id, ag_session_id
    )
    INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
    SELECT a.ag_session_id, a.mandant_id, 'pouvoir_activated',
      jsonb_build_object('pouvoir_id', a.id, 'mandataire_id', a.mandataire_id)
    FROM activated a;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_pending_pouvoirs ON resolutions;
DROP TRIGGER IF EXISTS trg_archive_scheduled_pouvoirs ON resolutions;
CREATE TRIGGER trg_archive_scheduled_pouvoirs
  AFTER UPDATE OF statut ON resolutions
  FOR EACH ROW EXECUTE FUNCTION trg_fn_archive_scheduled_pouvoirs();


-- ─── 9. MISE À JOUR DU TRIGGER présence physique ────────────────────────────
-- Il appelle maintenant handle_power_recovery pour bénéficier de la logique N+1.

CREATE OR REPLACE FUNCTION trg_fn_cancel_pouvoir_on_presence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id     UUID;
  v_active_resolution UUID;
BEGIN
  IF NEW.presence = TRUE AND (OLD.presence IS DISTINCT FROM TRUE) THEN
    SELECT id INTO v_ag_session_id
    FROM ag_sessions
    WHERE copropriete_id = NEW.copropriete_id AND statut IN ('planifiee', 'en_cours')
    ORDER BY created_at DESC LIMIT 1;

    IF v_ag_session_id IS NOT NULL THEN
      -- Trouver la résolution active (si vote en cours)
      SELECT id INTO v_active_resolution
      FROM resolutions WHERE ag_session_id = v_ag_session_id AND statut = 'en_cours'
      LIMIT 1;

      -- Si pas de résolution active, prendre la prochaine en_attente
      IF v_active_resolution IS NULL THEN
        SELECT id INTO v_active_resolution
        FROM resolutions WHERE ag_session_id = v_ag_session_id AND statut = 'en_attente'
        ORDER BY ordre ASC LIMIT 1;
      END IF;

      IF v_active_resolution IS NOT NULL THEN
        PERFORM handle_power_recovery(NEW.id, v_active_resolution);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_pouvoir_on_presence ON coproprietaires;
CREATE TRIGGER trg_cancel_pouvoir_on_presence
  AFTER UPDATE OF presence ON coproprietaires
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cancel_pouvoir_on_presence();


-- ─── 10. GRANTS ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION _next_resolution(UUID, INTEGER)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_power_recovery(UUID, UUID)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION handle_power_redonation(UUID, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_voting_weight(UUID, UUID)       TO anon, authenticated;
