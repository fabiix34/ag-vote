CREATE TABLE IF NOT EXISTS "public"."pouvoir_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "token" uuid UNIQUE DEFAULT gen_random_uuid(),
    "mandant_id" uuid NOT NULL REFERENCES "public"."coproprietaires"("id") ON DELETE CASCADE,
    "ag_session_id" uuid NOT NULL REFERENCES "public"."ag_sessions"("id") ON DELETE CASCADE,
    "used" boolean DEFAULT false,
    "created_at" timestamptz DEFAULT now(),
    -- Un mandant ne peut générer qu'un seul token par AG
    CONSTRAINT "pouvoir_tokens_mandant_ag_unique" UNIQUE ("mandant_id", "ag_session_id")
);

CREATE POLICY "Select pouvoir_tokens" ON "public"."pouvoir_tokens" FOR SELECT USING (true);
CREATE POLICY "Insert pouvoir_tokens" ON "public"."pouvoir_tokens" FOR INSERT WITH CHECK (true);
CREATE POLICY "Update pouvoir_tokens" ON "public"."pouvoir_tokens" FOR UPDATE USING (true) WITH CHECK (true);
ALTER TABLE "public"."pouvoir_tokens" ENABLE ROW LEVEL SECURITY;
