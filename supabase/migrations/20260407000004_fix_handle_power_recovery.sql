-- Patch : garde-fou dans handle_power_recovery si la résolution n'existe pas.
-- Évite une violation NOT NULL sur attendance_events.ag_session_id.

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
BEGIN
  SELECT ag_session_id, statut = 'en_cours', ordre
  INTO v_ag_session_id, v_is_vote_active, v_current_ordre
  FROM resolutions WHERE id = p_current_resolution_id;

  -- Résolution introuvable : retour propre sans lever d'exception
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
      UPDATE pouvoirs
      SET statut            = 'scheduled_stop',
          end_resolution_id = p_current_resolution_id
      WHERE id = v_active_pouvoir_id;
    ELSE
      -- Aucun vote actif : le pouvoir s'arrête immédiatement
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
    'pouvoir_id',             v_active_pouvoir_id,
    'current_resolution_id',  p_current_resolution_id,
    'vote_en_cours',          v_is_vote_active,
    'effective_from',         CASE WHEN v_is_vote_active THEN v_next_resolution_id ELSE p_current_resolution_id END,
    'n_plus_1_applied',       v_is_vote_active
  ));

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
