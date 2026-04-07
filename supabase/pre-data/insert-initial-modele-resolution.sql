INSERT INTO public.resolution_templates (titre, description, categorie, is_custom)
VALUES 
-- CATEGORIE : ADMINISTRATIF & GESTION
(
    'Election du Bureau de la séance', 
    'L''assemblée générale désigne M. / Mme {{nom}} en qualité de président de séance, et M. / Mme {{nom}} en qualité de scrutateurs.', 
    'Administratif', 
    false
),
(
    'Approbation du procès-verbal de l''AG précédente', 
    'L''assemblée générale, après en avoir pris connaissance, approuve le procès-verbal de l''assemblée générale du {{date_precedente}}.', 
    'Administratif', 
    false
),

-- CATEGORIE : COMPTABILITÉ
(
    'Approbation des comptes annuels', 
    'L''assemblée générale, après avoir pris connaissance du rapport du syndic et du conseil syndical, approuve les comptes de l''exercice clos le 31 décembre {{année}} tels qu''ils lui sont présentés.', 
    'Comptabilité', 
    false
),
(
    'Quitus au syndic', 
    'L''assemblée générale donne quitus au syndic pour sa gestion au cours de l''exercice {{année}}.', 
    'Comptabilité', 
    false
),
(
    'Approbation du budget prévisionnel', 
    'L''assemblée générale approuve le budget prévisionnel de l''exercice {{année_suivante}} pour un montant total de {{montant}} €.', 
    'Comptabilité', 
    false
),

-- CATEGORIE : TRAVAUX & ENTRETIEN
(
    'Travaux de ravalement - Lancement d''appel d''offres', 
    'L''assemblée générale décide de lancer une consultation pour le ravalement des façades durant l''année {{année}}. Le conseil syndical est chargé d''analyser les devis.', 
    'Travaux', 
    false
),
(
    'Entretien des espaces verts', 
    'L''assemblée générale décide de reconduire le contrat d''entretien des espaces verts pour la période {{année}}/{{année_suivante}} avec la société {{societe}}.', 
    'Travaux', 
    false
),

-- CATEGORIE : CONSEIL SYNDICAL
(
    'Élection des membres du conseil syndical', 
    'L''assemblée générale décide de fixer à {{nombre}} le nombre de membres du conseil syndical et élit pour une durée de {{duree}} ans : {{noms}}.', 
    'Conseil Syndical', 
    false
),
(
    'Fixation du montant des marchés (Art. 21)', 
    'L''assemblée générale arrête, en application de l''article 21 de la loi du 10 juillet 1965, le montant à partir duquel une mise en concurrence est obligatoire à {{montant}} € pour l''exercice {{année}}.', 
    'Gestion', 
    false
);