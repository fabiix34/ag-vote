-- Table pouvoirs : délégation de vote entre copropriétaires
CREATE TABLE IF NOT EXISTS "public"."pouvoirs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "mandant_id" uuid NOT NULL REFERENCES "public"."coproprietaires"("id") ON DELETE CASCADE,
    "mandataire_id" uuid NOT NULL REFERENCES "public"."coproprietaires"("id") ON DELETE CASCADE,
    "ag_session_id" uuid NOT NULL REFERENCES "public"."ag_sessions"("id") ON DELETE CASCADE,
    -- Votes imposés par le mandant : { "<resolution_id>": "pour"|"contre"|"abstention" }
    -- Si vide, le mandataire vote librement au nom du mandant
    "votes_imposes" jsonb DEFAULT '{}',
    "created_at" timestamptz DEFAULT now(),
    -- Un mandant ne peut donner pouvoir qu'une fois par AG
    CONSTRAINT "pouvoirs_mandant_ag_unique" UNIQUE ("mandant_id", "ag_session_id"),
    -- On ne peut pas être son propre mandataire
    CONSTRAINT "pouvoirs_no_self" CHECK ("mandant_id" <> "mandataire_id")
);

-- Index pour les lookups courants
CREATE INDEX idx_pouvoirs_mandataire ON "public"."pouvoirs" USING btree ("mandataire_id");
CREATE INDEX idx_pouvoirs_ag ON "public"."pouvoirs" USING btree ("ag_session_id");

-- Activer le realtime pour les mises à jour en direct
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."pouvoirs";