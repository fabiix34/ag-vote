-- ============================================================
-- POUVOIRS EN CHAÎNE
-- Si A donne son pouvoir à B, et que B possède déjà des pouvoirs
-- (X→B, Y→B, …), ces pouvoirs sont transférés à A : X→A, Y→A.
-- Toutes les opérations sont atomiques et auditées.
-- ============================================================

-- ─── RPC PRINCIPALE ─────────────────────────────────────────────────────────
-- create_pouvoir_with_chain(mandant_id, mandataire_id, ag_session_id)
-- 1. Insère le pouvoir principal mandant→mandataire (via trigger validation).
-- 2. Pour chaque pouvoir X→mandant actif ou scheduled_stop :
--    a. Archive X→mandant (statut = archived, end_resolution_id = courant/NULL)
--    b. Crée X→mandataire en préservant votes_imposes et règle N+1
--    c. Logue 'pouvoir_chaine_transfere' dans audit_logs
-- 3. Retourne { pouvoir_id, chained_count, chained_transfers[] }
-- En cas d'erreur (quota, …) : ROLLBACK implicite + re-raise.

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
BEGIN
  -- ── 1. Insérer le pouvoir principal (le trigger gère statut + quota) ──────
  INSERT INTO pouvoirs (mandant_id, mandataire_id, ag_session_id, votes_imposes)
  VALUES (p_mandant_id, p_mandataire_id, p_ag_session_id, '{}')
  RETURNING id, statut INTO v_new_pouvoir_id, v_new_pouvoir_statut;

  -- ── 2. Détecter la résolution en cours (pour N+1 et end_resolution) ────────
  SELECT r.id, r.ordre
  INTO v_active_resolution_id, v_active_resolution_ord
  FROM resolutions r
  WHERE r.ag_session_id = p_ag_session_id
    AND r.statut = 'en_cours'
  LIMIT 1;

  -- Résolution suivante (N+1) si vote en cours
  IF v_active_resolution_id IS NOT NULL THEN
    SELECT r.id INTO v_next_resolution_id
    FROM resolutions r
    WHERE r.ag_session_id = p_ag_session_id
      AND r.ordre > v_active_resolution_ord
    ORDER BY r.ordre
    LIMIT 1;
  END IF;

  -- ── 3. Transférer les pouvoirs X→mandant vers X→mandataire ───────────────
  FOR v_chain_row IN
    SELECT p.id, p.mandant_id, p.votes_imposes, p.statut,
           p.start_resolution_id, p.end_resolution_id
    FROM pouvoirs p
    WHERE p.mandataire_id = p_mandant_id
      AND p.ag_session_id = p_ag_session_id
      AND p.statut IN ('active', 'scheduled_stop', 'pending_activation')
  LOOP
    -- a. Archiver le pouvoir existant X→mandant
    IF v_active_resolution_id IS NOT NULL THEN
      -- Vote en cours : scheduled_stop à la fin de la résolution courante
      UPDATE pouvoirs
      SET statut             = 'scheduled_stop',
          end_resolution_id  = v_active_resolution_id
      WHERE id = v_chain_row.id
        AND statut NOT IN ('cancelled', 'archived');
    ELSE
      -- Pas de vote en cours : archiver immédiatement
      UPDATE pouvoirs
      SET statut     = 'archived',
          deleted_at = now()
      WHERE id = v_chain_row.id
        AND statut NOT IN ('cancelled', 'archived');
    END IF;

    -- b. Créer X→mandataire avec start_resolution_id déjà fixé
    --    (le trigger respecte start_resolution_id si fourni)
    v_new_chain_start := CASE
      WHEN v_active_resolution_id IS NOT NULL THEN v_next_resolution_id
      ELSE NULL
    END;

    INSERT INTO pouvoirs (
      mandant_id,
      mandataire_id,
      ag_session_id,
      votes_imposes,
      start_resolution_id
    )
    VALUES (
      v_chain_row.mandant_id,
      p_mandataire_id,
      p_ag_session_id,
      v_chain_row.votes_imposes,
      v_new_chain_start
    )
    RETURNING id, statut INTO v_new_chain_id, v_new_chain_statut;

    -- c. Audit log par transfert
    INSERT INTO audit_logs (ag_session_id, coproprietaire_id, action, details)
    VALUES (
      p_ag_session_id,
      v_chain_row.mandant_id,
      'pouvoir_chaine_transfere',
      jsonb_build_object(
        'ancien_pouvoir_id',    v_chain_row.id,
        'nouveau_pouvoir_id',   v_new_chain_id,
        'ancien_mandataire_id', p_mandant_id,
        'nouveau_mandataire_id', p_mandataire_id,
        'statut_nouveau',       v_new_chain_statut,
        'start_resolution_id',  v_new_chain_start
      )
    );

    v_chained_ids       := array_append(v_chained_ids, v_chain_row.mandant_id);
    v_chained_transfers := array_append(
      v_chained_transfers,
      jsonb_build_object(
        'mandant_id',        v_chain_row.mandant_id,
        'ancien_pouvoir_id', v_chain_row.id,
        'nouveau_pouvoir_id', v_new_chain_id,
        'statut',            v_new_chain_statut
      )
    );
  END LOOP;

  -- ── 4. Audit log principal (pouvoir B→C avec résumé de la chaîne) ─────────
  INSERT INTO audit_logs (ag_session_id, coproprietaire_id, action, details)
  VALUES (
    p_ag_session_id,
    p_mandant_id,
    'pouvoir_avec_chaine',
    jsonb_build_object(
      'pouvoir_id',       v_new_pouvoir_id,
      'mandataire_id',    p_mandataire_id,
      'statut',           v_new_pouvoir_statut,
      'chained_count',    array_length(v_chained_ids, 1),
      'chained_mandants', to_jsonb(v_chained_ids)
    )
  );

  RETURN jsonb_build_object(
    'pouvoir_id',       v_new_pouvoir_id,
    'statut',           v_new_pouvoir_statut,
    'chained_count',    COALESCE(array_length(v_chained_ids, 1), 0),
    'chained_transfers', to_jsonb(v_chained_transfers)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise proprement (quota exceeded, etc.)
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION create_pouvoir_with_chain(UUID, UUID, UUID) TO anon, authenticated;
