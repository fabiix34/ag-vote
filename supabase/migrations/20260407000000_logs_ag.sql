-- Table de logs immuable : connexions, déconnexions, échanges de pouvoirs
-- Aucune politique UPDATE ni DELETE → les entrées ne peuvent jamais être modifiées ou supprimées.

CREATE TABLE logs_ag (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ag_session_id     UUID        REFERENCES ag_sessions(id) ON DELETE SET NULL,
  coproprietaire_id UUID        NOT NULL REFERENCES coproprietaires(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL CHECK (type IN ('connexion', 'deconnexion', 'pouvoir_donne', 'pouvoir_revoque')),
  details           JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE logs_ag ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte (syndic + coproprietaires peuvent consulter l'historique)
CREATE POLICY "logs_ag_select" ON logs_ag
  FOR SELECT USING (true);

-- Insertion ouverte (les clients enregistrent leurs propres événements)
CREATE POLICY "logs_ag_insert" ON logs_ag
  FOR INSERT WITH CHECK (true);

-- Pas de politique UPDATE → aucune mise à jour possible
-- Pas de politique DELETE → aucune suppression possible
-- La table est ainsi immuable par construction.
