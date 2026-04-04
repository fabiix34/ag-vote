-- Activation du vote par correspondance sur une AG planifiée
ALTER TABLE "public"."ag_sessions"
  ADD COLUMN IF NOT EXISTS "vote_anticipe_actif" boolean DEFAULT false;
