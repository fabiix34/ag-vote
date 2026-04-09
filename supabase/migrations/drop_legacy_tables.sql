-- ============================================================
-- Migration : suppression des tables legacy logs_ag et attendance_events
-- Ces données sont désormais consolidées dans audit_logs.
-- ============================================================

-- Optionnel : archiver les données avant suppression
-- INSERT INTO audit_logs (ag_session_id, coproprietaire_id, user_id, action, event_type, details, payload, created_at)
-- SELECT
--   ag_session_id,
--   coproprietaire_id,
--   coproprietaire_id AS user_id,
--   type              AS action,
--   upper(type)       AS event_type,
--   details,
--   details           AS payload,
--   created_at
-- FROM logs_ag
-- ON CONFLICT DO NOTHING;

-- Supprimer les politiques RLS avant de droper les tables
DROP POLICY IF EXISTS "allow_insert_logs_ag"       ON logs_ag;
DROP POLICY IF EXISTS "allow_select_logs_ag"       ON logs_ag;
DROP POLICY IF EXISTS "allow_insert_attendance"    ON attendance_events;
DROP POLICY IF EXISTS "allow_select_attendance"    ON attendance_events;

-- Supprimer les triggers éventuels
DROP TRIGGER IF EXISTS trg_logs_ag_immutable        ON logs_ag;
DROP TRIGGER IF EXISTS trg_attendance_events_immutable ON attendance_events;

-- Supprimer les tables
DROP TABLE IF EXISTS logs_ag          CASCADE;
DROP TABLE IF EXISTS attendance_events CASCADE;
