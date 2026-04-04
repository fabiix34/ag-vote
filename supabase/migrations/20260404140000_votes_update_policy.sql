CREATE POLICY "Update votes" ON "public"."votes" FOR UPDATE USING (true) WITH CHECK (true);
