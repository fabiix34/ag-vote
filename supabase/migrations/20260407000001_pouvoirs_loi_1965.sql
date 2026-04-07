-- ============================================================
-- LOI DU 10 JUILLET 1965 – ARTICLE 22 : GESTION DES POUVOIRS
-- ============================================================
-- Ce fichier implémente les règles métier suivantes :
--   1. Règle des quotas : max 3 pouvoirs PAR mandataire, SAUF si
--      (mandataire + mandants) ≤ 10 % des millièmes totaux.
--   2. Temporalité N+1 : pouvoir donné pendant un vote actif →
--      statut pending_activation, effectif à la résolution suivante.
--   3. Présence physique : la connexion en séance annule automatiquement
--      le pouvoir donné par anticipation pour les votes restants.
--   4. Soft-delete : les pouvoirs annulés sont conservés (PV d'AG).
-- ============================================================

-- ─── 1. TABLE AUDIT_LOGS ────────────────────────────────────────────────────
-- Historique juridique immuable (pas de RLS UPDATE ni DELETE).
-- Alimentée à la fois par les triggers et par le frontend.

CREATE TABLE IF NOT EXISTS audit_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ag_session_id     UUID        REFERENCES ag_sessions(id) ON DELETE SET NULL,
  coproprietaire_id UUID        REFERENCES coproprietaires(id) ON DELETE SET NULL,
  -- actions possibles :
  --   pouvoir_created_active   : pouvoir inséré et immédiatement actif
  --   pouvoir_created_pending  : pouvoir inséré, en attente (vote en cours)
  --   pouvoir_activated        : passage pending_activation → active
  --   pouvoir_cancelled_presence : annulé automatiquement (présence physique)
  --   pouvoir_cancelled_manual   : annulé manuellement par le mandant
  --   pouvoir_quota_violation  : tentative bloquée (loggée côté frontend)
  action            TEXT        NOT NULL,
  details           JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (true);
-- Aucune politique UPDATE ni DELETE → immuabilité garantie.


-- ─── 2. MODIFICATION DE LA TABLE POUVOIRS ───────────────────────────────────
-- Ajout des colonnes pour le cycle de vie et la temporalité.

ALTER TABLE pouvoirs
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'active'
    CHECK (statut IN ('active', 'pending_activation', 'cancelled')),
  ADD COLUMN IF NOT EXISTS pivot_resolution_id UUID
    REFERENCES resolutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pouvoirs_statut ON pouvoirs(statut);
CREATE INDEX IF NOT EXISTS idx_pouvoirs_pivot ON pouvoirs(pivot_resolution_id)
  WHERE pivot_resolution_id IS NOT NULL;

-- Remplacer la contrainte UNIQUE globale par une contrainte partielle :
-- un mandant peut ré-accorder son pouvoir APRÈS annulation dans la même AG.
ALTER TABLE pouvoirs
  DROP CONSTRAINT IF EXISTS pouvoirs_mandant_ag_unique;

CREATE UNIQUE INDEX IF NOT EXISTS pouvoirs_mandant_ag_active_unique
  ON pouvoirs(mandant_id, ag_session_id)
  WHERE statut != 'cancelled';


-- ─── 3. RPC : VÉRIFICATION DU QUOTA (APPEL FRONTEND) ────────────────────────
-- Retourne { allowed, count, ratio, reason?, detail? }.
-- Le frontend l'appelle AVANT d'insérer pour afficher un message lisible.

CREATE OR REPLACE FUNCTION check_pouvoir_quota_rpc(
  p_mandataire_id   UUID,
  p_ag_session_id   UUID,
  p_new_mandant_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copropriete_id        UUID;
  v_total_tantiemes       INTEGER;
  v_mandataire_tantiemes  INTEGER;
  v_mandants_tantiemes    INTEGER;
  v_new_mandant_tantiemes INTEGER;
  v_pouvoir_count         INTEGER;
  v_combined_ratio        NUMERIC;
BEGIN
  -- Nombre de pouvoirs actifs ou en attente du mandataire pour cette AG
  SELECT COUNT(*) INTO v_pouvoir_count
  FROM pouvoirs
  WHERE mandataire_id = p_mandataire_id
    AND ag_session_id = p_ag_session_id
    AND statut IN ('active', 'pending_activation');

  -- Sous 3 pouvoirs → toujours autorisé
  IF v_pouvoir_count < 3 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'count',   v_pouvoir_count
    );
  END IF;

  -- === Règle des 10 % ===
  SELECT a.copropriete_id INTO v_copropriete_id
  FROM ag_sessions a WHERE a.id = p_ag_session_id;

  SELECT COALESCE(SUM(tantiemes), 0) INTO v_total_tantiemes
  FROM coproprietaires WHERE copropriete_id = v_copropriete_id;

  SELECT COALESCE(tantiemes, 0) INTO v_mandataire_tantiemes
  FROM coproprietaires WHERE id = p_mandataire_id;

  SELECT COALESCE(SUM(c.tantiemes), 0) INTO v_mandants_tantiemes
  FROM pouvoirs p
  JOIN coproprietaires c ON c.id = p.mandant_id
  WHERE p.mandataire_id = p_mandataire_id
    AND p.ag_session_id = p_ag_session_id
    AND p.statut IN ('active', 'pending_activation');

  SELECT COALESCE(tantiemes, 0) INTO v_new_mandant_tantiemes
  FROM coproprietaires WHERE id = p_new_mandant_id;

  v_combined_ratio := CASE
    WHEN v_total_tantiemes > 0
    THEN (v_mandataire_tantiemes + v_mandants_tantiemes + v_new_mandant_tantiemes)::NUMERIC
         / v_total_tantiemes
    ELSE 0
  END;

  IF v_combined_ratio > 0.10 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'QUOTA_EXCEEDED',
      'count',   v_pouvoir_count,
      'ratio',   ROUND(v_combined_ratio * 100, 2),
      'detail',  format(
        'Ce mandataire détient déjà %s pouvoirs. Son total de voix atteindrait %s %% des millièmes, ce qui dépasse le plafond de 10 %% fixé par l''art. 22 de la loi du 10/07/1965.',
        v_pouvoir_count,
        ROUND(v_combined_ratio * 100, 1)
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'count',   v_pouvoir_count,
    'ratio',   ROUND(v_combined_ratio * 100, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_pouvoir_quota_rpc(UUID, UUID, UUID) TO anon, authenticated;


-- ─── 4. TRIGGER : VALIDATION À L'INSERTION ──────────────────────────────────
-- BEFORE INSERT : fixe le statut (active / pending_activation)
--                 et bloque si le quota art. 22 est dépassé.

CREATE OR REPLACE FUNCTION trg_fn_validate_pouvoir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_copropriete_id        UUID;
  v_active_resolution_id  UUID;
  v_total_tantiemes       INTEGER;
  v_mandataire_tantiemes  INTEGER;
  v_mandants_tantiemes    INTEGER;
  v_new_mandant_tantiemes INTEGER;
  v_pouvoir_count         INTEGER;
  v_combined_ratio        NUMERIC;
  v_audit_action          TEXT;
BEGIN
  -- === RÈGLE DE TEMPORALITÉ ===
  -- S'il existe une résolution en cours de vote, le pouvoir est en attente.
  SELECT r.id INTO v_active_resolution_id
  FROM resolutions r
  WHERE r.ag_session_id = NEW.ag_session_id
    AND r.statut = 'en_cours'
  LIMIT 1;

  IF v_active_resolution_id IS NOT NULL THEN
    NEW.statut               := 'pending_activation';
    NEW.pivot_resolution_id  := v_active_resolution_id;
    v_audit_action           := 'pouvoir_created_pending';
  ELSE
    NEW.statut               := 'active';
    v_audit_action           := 'pouvoir_created_active';
  END IF;

  -- === RÈGLE DES QUOTAS (art. 22) ===
  SELECT COUNT(*) INTO v_pouvoir_count
  FROM pouvoirs
  WHERE mandataire_id = NEW.mandataire_id
    AND ag_session_id = NEW.ag_session_id
    AND statut IN ('active', 'pending_activation');

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
      AND p.statut IN ('active', 'pending_activation');

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
          'Le mandataire détient déjà %s pouvoirs et son total de voix atteindrait %s %% des millièmes (plafond art. 22 : 10 %%).',
          v_pouvoir_count,
          ROUND(v_combined_ratio * 100, 1)
        ),
        HINT = 'QUOTA_EXCEEDED';
    END IF;
  END IF;

  -- === AUDIT LOG (trigger interne → non falsifiable) ===
  INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
  VALUES (
    NEW.ag_session_id,
    NEW.mandant_id,
    v_audit_action,
    jsonb_build_object(
      'mandataire_id',      NEW.mandataire_id,
      'statut',             NEW.statut,
      'pivot_resolution',   NEW.pivot_resolution_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pouvoir ON pouvoirs;
CREATE TRIGGER trg_validate_pouvoir
  BEFORE INSERT ON pouvoirs
  FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_pouvoir();


-- ─── 5. TRIGGER : ACTIVATION DES POUVOIRS EN ATTENTE ────────────────────────
-- AFTER UPDATE sur resolutions : quand une résolution passe à 'termine',
-- les pouvoirs dont c'est le pivot_resolution_id deviennent actifs (N+1).

CREATE OR REPLACE FUNCTION trg_fn_activate_pending_pouvoirs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'termine' AND OLD.statut = 'en_cours' THEN
    -- Activer les pouvoirs liés à cette résolution charnière
    WITH activated AS (
      UPDATE pouvoirs
      SET statut              = 'active',
          pivot_resolution_id = NULL
      WHERE pivot_resolution_id = NEW.id
        AND statut = 'pending_activation'
      RETURNING id, mandant_id, mandataire_id, ag_session_id
    )
    INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
    SELECT
      a.ag_session_id,
      a.mandant_id,
      'pouvoir_activated',
      jsonb_build_object(
        'pouvoir_id',        a.id,
        'mandataire_id',     a.mandataire_id,
        'pivot_resolution',  NEW.id
      )
    FROM activated a;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_pending_pouvoirs ON resolutions;
CREATE TRIGGER trg_activate_pending_pouvoirs
  AFTER UPDATE OF statut ON resolutions
  FOR EACH ROW EXECUTE FUNCTION trg_fn_activate_pending_pouvoirs();


-- ─── 6. TRIGGER : ANNULATION PAR PRÉSENCE PHYSIQUE ──────────────────────────
-- AFTER UPDATE sur coproprietaires : quand presence passe à TRUE,
-- tout pouvoir actif ou en attente donné par ce copropriétaire est annulé.

CREATE OR REPLACE FUNCTION trg_fn_cancel_pouvoir_on_presence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ag_session_id UUID;
BEGIN
  -- Uniquement si la présence vient de passer à TRUE
  IF NEW.presence = TRUE AND (OLD.presence IS DISTINCT FROM TRUE) THEN
    SELECT id INTO v_ag_session_id
    FROM ag_sessions
    WHERE copropriete_id = NEW.copropriete_id
      AND statut IN ('planifiee', 'en_cours')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_ag_session_id IS NOT NULL THEN
      WITH cancelled AS (
        UPDATE pouvoirs
        SET statut     = 'cancelled',
            deleted_at = now()
        WHERE mandant_id    = NEW.id
          AND ag_session_id = v_ag_session_id
          AND statut IN ('active', 'pending_activation')
        RETURNING id, mandataire_id, ag_session_id
      )
      INSERT INTO audit_logs(ag_session_id, coproprietaire_id, action, details)
      SELECT
        c.ag_session_id,
        NEW.id,
        'pouvoir_cancelled_presence',
        jsonb_build_object(
          'pouvoir_id',    c.id,
          'mandataire_id', c.mandataire_id,
          'raison',        'Présence physique du mandant en séance'
        )
      FROM cancelled c;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_pouvoir_on_presence ON coproprietaires;
CREATE TRIGGER trg_cancel_pouvoir_on_presence
  AFTER UPDATE OF presence ON coproprietaires
  FOR EACH ROW EXECUTE FUNCTION trg_fn_cancel_pouvoir_on_presence();


-- ─── 7. RLS SUR POUVOIRS ────────────────────────────────────────────────────
-- Les soft-deleted (cancelled) restent lisibles pour le PV d'AG.
-- Aucune restriction de lecture supplémentaire.

ALTER TABLE pouvoirs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pouvoirs' AND policyname = 'pouvoirs_select'
  ) THEN
    CREATE POLICY "pouvoirs_select" ON pouvoirs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pouvoirs' AND policyname = 'pouvoirs_insert'
  ) THEN
    CREATE POLICY "pouvoirs_insert" ON pouvoirs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pouvoirs' AND policyname = 'pouvoirs_update'
  ) THEN
    CREATE POLICY "pouvoirs_update" ON pouvoirs FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pouvoirs' AND policyname = 'pouvoirs_delete'
  ) THEN
    CREATE POLICY "pouvoirs_delete" ON pouvoirs FOR DELETE USING (true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_pouvoir_quota_rpc(UUID, UUID, UUID) TO anon, authenticated;
