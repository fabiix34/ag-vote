alter table ag_sessions drop column vote_anticipe_actif;

alter table ag_sessions drop column statut;

-- 1. Création du type ENUM (si ce n'est pas déjà fait)
DO $$ BEGIN
    CREATE TYPE ag_statut_enum AS ENUM ('planifiee', 'vote_anticipe', 'en_cours', 'terminee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Ajout de la nouvelle colonne avec le bon type et une valeur par défaut
ALTER TABLE public.ag_sessions 
ADD COLUMN statut ag_statut_enum NOT NULL DEFAULT 'planifiee'::ag_statut_enum;

-- 3. AJOUT DE L'OPÉRATEUR DE COMPARAISON (Crucial pour votre JS)
-- Cela permet de faire : WHERE statut = 'en_cours' sans erreur
CREATE OR REPLACE FUNCTION ag_statut_eq_text(ag_statut_enum, text)
RETURNS boolean AS $$
    SELECT $1 = $2::ag_statut_enum;
$$ LANGUAGE sql IMMUTABLE;

CREATE OPERATOR = (
    LEFTARG = ag_statut_enum,
    RIGHTARG = text,
    PROCEDURE = ag_statut_eq_text,
    COMMUTATOR = =,
    NEGATOR = <>
);