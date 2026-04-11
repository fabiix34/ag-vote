/**
 * Calcul des règles de majorité pour les résolutions d'AG
 * Conformément à la loi du 10 juillet 1965 relative à la copropriété
 *
 * @typedef {"ARTICLE_24" | "ARTICLE_25" | "ARTICLE_26"} MajorityRule
 *
 * @typedef {Object} VoteResult
 * @property {boolean} passed         - La résolution est adoptée
 * @property {number}  votesFor       - Tantièmes "pour"
 * @property {number}  votesAgainst   - Tantièmes "contre"
 * @property {boolean} fallbackPossible - Un second vote à une majorité inférieure est possible
 * @property {MajorityRule|null} fallbackArticle - Article applicable pour le second vote
 * @property {boolean} undetermined   - Pas de règle de majorité définie (calcul impossible)
 */

/**
 * Évalue si une résolution est adoptée selon sa règle de majorité.
 *
 * @param {Object}   resolution           - La résolution, doit contenir resolution.majority_rule
 * @param {Object[]} votes                - Tous les votes de l'AG (filtrés ensuite par resolution_id)
 * @param {Object[]} coproprietaires      - Tous les copropriétaires (pour tantièmes totaux)
 * @returns {VoteResult}
 */
export function evaluateResolutionVotes(resolution, votes, coproprietaires) {
  const votesForRes = votes.filter((v) => v.resolution_id === resolution.id);

  const pour    = votesForRes.filter((v) => v.choix === "pour");
  const contre  = votesForRes.filter((v) => v.choix === "contre");

  // Somme des tantièmes exprimés par choix
  const tantPour   = pour.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);
  const tantContre = contre.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);

  // Tantièmes et nombre total de copropriétaires de la copropriété
  const totalTantiemes = coproprietaires.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const totalOwners    = coproprietaires.length;

  // Chaque ligne de vote représente un copropriétaire distinct
  const ownersFor = pour.length;

  const undetermined = { passed: false, votesFor: tantPour, votesAgainst: tantContre, fallbackPossible: false, fallbackArticle: null, undetermined: true };

  if (!resolution.majority_rule) return undetermined;

  let passed          = false;
  let fallbackPossible = false;
  let fallbackArticle  = null;

  switch (resolution.majority_rule) {
    case "ARTICLE_24":
      // Art. 24 — Majorité simple
      // La résolution est adoptée si les voix "pour" dépassent les voix "contre".
      // Seuls les copropriétaires présents ou représentés comptent ; les abstentions
      // et les absents sont ignorés.
      passed = tantPour > tantContre;
      break;

    case "ARTICLE_25":
      // Art. 25 — Majorité absolue
      // La résolution doit obtenir plus de la moitié de TOUS les tantièmes de la
      // copropriété (y compris ceux des absents).
      passed = tantPour > totalTantiemes / 2;

      // Art. 25-1 : si les voix "pour" représentent au moins 1/3 des tantièmes
      // totaux sans atteindre la majorité absolue, un second vote à la majorité
      // simple (art. 24) peut être organisé lors de la même assemblée.
      if (!passed && tantPour >= totalTantiemes / 3) {
        fallbackPossible = true;
        fallbackArticle  = "ARTICLE_24";
      }
      break;

    case "ARTICLE_26":
      // Art. 26 — Double majorité
      // Deux conditions doivent être simultanément remplies :
      //   1. La majorité des copropriétaires (en nombre de personnes)
      //   2. Au moins les 2/3 des tantièmes totaux de la copropriété
      {
        const condition1 = ownersFor > totalOwners / 2;
        const condition2 = tantPour >= (2 / 3) * totalTantiemes;
        passed = condition1 && condition2;

        // Second vote possible à l'art. 25 si : au moins la moitié des copros
        // en nombre ET au moins 1/3 des tantièmes totaux.
        if (!passed && ownersFor >= totalOwners / 2 && tantPour >= totalTantiemes / 3) {
          fallbackPossible = true;
          fallbackArticle  = "ARTICLE_25";
        }
      }
      break;

    default:
      return undetermined;
  }

  return { passed, votesFor: tantPour, votesAgainst: tantContre, fallbackPossible, fallbackArticle, undetermined: false };
}

/** Libellés affichables pour chaque règle de majorité */
export const MAJORITY_RULE_LABELS = {
  ARTICLE_24: "Article 24 — Majorité simple",
  ARTICLE_25: "Article 25 — Majorité absolue",
  ARTICLE_26: "Article 26 — Double majorité",
};

/** Libellés courts pour les messages de verdict */
export const MAJORITY_RULE_SHORT = {
  ARTICLE_24: "l'article 24",
  ARTICLE_25: "l'article 25",
  ARTICLE_26: "l'article 26",
};

/** Options pour le champ select dans le formulaire */
export const MAJORITY_RULE_OPTIONS = [
  { value: "ARTICLE_24", label: "Article 24 — Majorité simple" },
  { value: "ARTICLE_25", label: "Article 25 — Majorité absolue" },
  { value: "ARTICLE_26", label: "Article 26 — Double majorité" },
];
