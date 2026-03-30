


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ag_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "copropriete_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'planifiee'::"text" NOT NULL,
    "date_ag" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ag_sessions_statut_check" CHECK (("statut" = ANY (ARRAY['planifiee'::"text", 'en_cours'::"text", 'terminee'::"text"])))
);


ALTER TABLE "public"."ag_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coproprietaires" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "prenom" "text" NOT NULL,
    "email" "text" NOT NULL,
    "date_naissance" "text" NOT NULL,
    "tantiemes" integer DEFAULT 0 NOT NULL,
    "presence" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "copropriete_id" "uuid"
);


ALTER TABLE "public"."coproprietaires" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coproprietes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "syndic_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "adresse" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."coproprietes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resolution_id" "uuid",
    "nom" "text" NOT NULL,
    "path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resolution_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "titre" "text" NOT NULL,
    "description" "text" NOT NULL,
    "categorie" "text" NOT NULL,
    "is_custom" boolean DEFAULT false
);


ALTER TABLE "public"."resolution_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resolutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titre" "text" NOT NULL,
    "description" "text",
    "statut" "text" DEFAULT 'en_attente'::"text" NOT NULL,
    "ordre" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "montant" integer NOT NULL,
    "ag_session_id" "uuid",
    CONSTRAINT "resolutions_statut_check" CHECK (("statut" = ANY (ARRAY['en_attente'::"text", 'en_cours'::"text", 'termine'::"text"])))
);


ALTER TABLE "public"."resolutions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."resolutions"."montant" IS 'Montant associé à la résolution, -1 si résolution sans montant';



CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coproprietaire_id" "uuid" NOT NULL,
    "resolution_id" "uuid" NOT NULL,
    "choix" "text" NOT NULL,
    "tantiemes_poids" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "votes_choix_check" CHECK (("choix" = ANY (ARRAY['pour'::"text", 'contre'::"text", 'abstention'::"text"])))
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."resultats_votes" AS
 SELECT "r"."id" AS "resolution_id",
    "r"."titre",
    "r"."statut",
    "count"("v"."id") AS "total_votes",
    "sum"(
        CASE
            WHEN ("v"."choix" = 'pour'::"text") THEN 1
            ELSE 0
        END) AS "nb_pour",
    "sum"(
        CASE
            WHEN ("v"."choix" = 'contre'::"text") THEN 1
            ELSE 0
        END) AS "nb_contre",
    "sum"(
        CASE
            WHEN ("v"."choix" = 'abstention'::"text") THEN 1
            ELSE 0
        END) AS "nb_abstention",
    "sum"(
        CASE
            WHEN ("v"."choix" = 'pour'::"text") THEN "v"."tantiemes_poids"
            ELSE 0
        END) AS "tantiemes_pour",
    "sum"(
        CASE
            WHEN ("v"."choix" = 'contre'::"text") THEN "v"."tantiemes_poids"
            ELSE 0
        END) AS "tantiemes_contre",
    "sum"(
        CASE
            WHEN ("v"."choix" = 'abstention'::"text") THEN "v"."tantiemes_poids"
            ELSE 0
        END) AS "tantiemes_abstention",
    "sum"("v"."tantiemes_poids") AS "total_tantiemes_votes"
   FROM ("public"."resolutions" "r"
     LEFT JOIN "public"."votes" "v" ON (("r"."id" = "v"."resolution_id")))
  GROUP BY "r"."id", "r"."titre", "r"."statut";


ALTER VIEW "public"."resultats_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."syndics" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "nom" "text",
    "prenom" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."syndics" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ag_sessions"
    ADD CONSTRAINT "ag_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coproprietaires"
    ADD CONSTRAINT "coproprietaires_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."coproprietaires"
    ADD CONSTRAINT "coproprietaires_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coproprietes"
    ADD CONSTRAINT "coproprietes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resolution_templates"
    ADD CONSTRAINT "resolution_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resolutions"
    ADD CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."syndics"
    ADD CONSTRAINT "syndics_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."syndics"
    ADD CONSTRAINT "syndics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_coproprietaire_id_resolution_id_key" UNIQUE ("coproprietaire_id", "resolution_id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_resolutions_statut" ON "public"."resolutions" USING "btree" ("statut");



CREATE INDEX "idx_votes_coproprietaire" ON "public"."votes" USING "btree" ("coproprietaire_id");



CREATE INDEX "idx_votes_resolution" ON "public"."votes" USING "btree" ("resolution_id");



ALTER TABLE ONLY "public"."ag_sessions"
    ADD CONSTRAINT "ag_sessions_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "public"."coproprietes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coproprietaires"
    ADD CONSTRAINT "coproprietaires_copropriete_id_fkey" FOREIGN KEY ("copropriete_id") REFERENCES "public"."coproprietes"("id");



ALTER TABLE ONLY "public"."coproprietes"
    ADD CONSTRAINT "coproprietes_syndic_id_fkey" FOREIGN KEY ("syndic_id") REFERENCES "public"."syndics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "public"."resolutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resolutions"
    ADD CONSTRAINT "resolutions_ag_session_id_fkey" FOREIGN KEY ("ag_session_id") REFERENCES "public"."ag_sessions"("id");



ALTER TABLE ONLY "public"."syndics"
    ADD CONSTRAINT "syndics_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_coproprietaire_id_fkey" FOREIGN KEY ("coproprietaire_id") REFERENCES "public"."coproprietaires"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "public"."resolutions"("id") ON DELETE CASCADE;



CREATE POLICY "Delete coproprietaires" ON "public"."coproprietaires" FOR DELETE USING (true);



CREATE POLICY "Delete resolutions" ON "public"."resolutions" FOR DELETE USING (true);



CREATE POLICY "Insertion coproprietaires" ON "public"."coproprietaires" FOR INSERT WITH CHECK (true);



CREATE POLICY "Insertion resolutions" ON "public"."resolutions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Insertion votes" ON "public"."votes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Lecture publique coproprietaires" ON "public"."coproprietaires" FOR SELECT USING (true);



CREATE POLICY "Lecture publique resolutions" ON "public"."resolutions" FOR SELECT USING (true);



CREATE POLICY "Lecture publique votes" ON "public"."votes" FOR SELECT USING (true);



CREATE POLICY "Update coproprietaires" ON "public"."coproprietaires" FOR UPDATE USING (true);



CREATE POLICY "Update resolutions" ON "public"."resolutions" FOR UPDATE USING (true);



ALTER TABLE "public"."coproprietaires" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete admin" ON "public"."documents" FOR DELETE USING (true);



CREATE POLICY "delete documents" ON "public"."documents" FOR DELETE USING (true);



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert admin" ON "public"."documents" FOR INSERT WITH CHECK (true);



CREATE POLICY "insert documents" ON "public"."documents" FOR INSERT WITH CHECK (true);



CREATE POLICY "lecture publique" ON "public"."documents" FOR SELECT USING (true);



ALTER TABLE "public"."resolutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select documents" ON "public"."documents" FOR SELECT USING (true);



ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."resolutions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."votes";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."ag_sessions" TO "anon";
GRANT ALL ON TABLE "public"."ag_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."ag_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."coproprietaires" TO "anon";
GRANT ALL ON TABLE "public"."coproprietaires" TO "authenticated";
GRANT ALL ON TABLE "public"."coproprietaires" TO "service_role";



GRANT ALL ON TABLE "public"."coproprietes" TO "anon";
GRANT ALL ON TABLE "public"."coproprietes" TO "authenticated";
GRANT ALL ON TABLE "public"."coproprietes" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."resolution_templates" TO "anon";
GRANT ALL ON TABLE "public"."resolution_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."resolution_templates" TO "service_role";



GRANT ALL ON TABLE "public"."resolutions" TO "anon";
GRANT ALL ON TABLE "public"."resolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."resolutions" TO "service_role";



GRANT ALL ON TABLE "public"."votes" TO "anon";
GRANT ALL ON TABLE "public"."votes" TO "authenticated";
GRANT ALL ON TABLE "public"."votes" TO "service_role";



GRANT ALL ON TABLE "public"."resultats_votes" TO "anon";
GRANT ALL ON TABLE "public"."resultats_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."resultats_votes" TO "service_role";



GRANT ALL ON TABLE "public"."syndics" TO "anon";
GRANT ALL ON TABLE "public"."syndics" TO "authenticated";
GRANT ALL ON TABLE "public"."syndics" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


  create policy "delete resolution-docs"
  on "storage"."objects"
  as permissive
  for delete
  to public
using ((bucket_id = 'resolution-docs'::text));



  create policy "read resolution-docs"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'resolution-docs'::text));



  create policy "upload resolution-docs"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'resolution-docs'::text));



