/**
 * Calcul des règles de majorité pour les résolutions d'AG
 * Conformément à la loi du 10 juillet 1965 relative à la copropriété
 */

const formatTantiemes = (n) => n?.toLocaleString("fr-FR") ?? "0";

/**
 * Évalue si une résolution est adoptée selon sa règle de majorité.
 *
 * @param {Object}   resolution      - La résolution (doit contenir majority_rule)
 * @param {Object[]} votes           - Tous les votes de l'AG
 * @param {Object[]} coproprietaires - Tous les copropriétaires
 * @returns {{ passed, votesFor, votesAgainst, fallbackPossible, fallbackArticle, undetermined }}
 */
export function evaluateResolutionVotes(resolution, votes, coproprietaires) {
  const votesForRes = votes.filter((v) => v.resolution_id === resolution.id);

  const pour   = votesForRes.filter((v) => v.choix === "pour");
  const contre = votesForRes.filter((v) => v.choix === "contre");

  const tantPour   = pour.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);
  const tantContre = contre.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);

  const totalTantiemes = coproprietaires.reduce((s, c) => s + (c.tantiemes || 0), 0);
  const totalOwners    = coproprietaires.length;
  const ownersFor      = pour.length;

  const undetermined = {
    passed: false,
    votesFor: tantPour,
    votesAgainst: tantContre,
    fallbackPossible: false,
    fallbackArticle: null,
    undetermined: true,
  };

  if (!resolution.majority_rule) return undetermined;

  let passed          = false;
  let fallbackPossible = false;
  let fallbackArticle  = null;

  switch (resolution.majority_rule) {
    case "ARTICLE_24":
      // Art. 24 — Majorité simple
      passed = tantPour > tantContre;
      break;

    case "ARTICLE_25":
      // Art. 25 — Majorité absolue (> 50 % de tous les tantièmes)
      passed = tantPour > totalTantiemes / 2;
      // Art. 25-1 : fallback vers art. 24 si ≥ 1/3 des tantièmes
      if (!passed && tantPour >= totalTantiemes / 3) {
        fallbackPossible = true;
        fallbackArticle  = "ARTICLE_24";
      }
      break;

    case "ARTICLE_26":
      // Art. 26 — Double majorité (majorité des copros + ≥ 2/3 des tantièmes)
      {
        const condition1 = ownersFor > totalOwners / 2;
        const condition2 = tantPour >= (2 / 3) * totalTantiemes;
        passed = condition1 && condition2;
        // Fallback vers art. 25 si ≥ moitié des copros ET ≥ 1/3 des tantièmes
        if (!passed && ownersFor >= totalOwners / 2 && tantPour >= totalTantiemes / 3) {
          fallbackPossible = true;
          fallbackArticle  = "ARTICLE_25";
        }
      }
      break;

    default:
      return undetermined;
  }

  return {
    passed,
    votesFor: tantPour,
    votesAgainst: tantContre,
    fallbackPossible,
    fallbackArticle,
    undetermined: false,
  };
}

export const MAJORITY_RULE_LABELS = {
  ARTICLE_24: "Article 24 — Majorité simple",
  ARTICLE_25: "Article 25 — Majorité absolue",
  ARTICLE_26: "Article 26 — Double majorité",
};

export const MAJORITY_RULE_OPTIONS = [
  { value: "ARTICLE_24", label: "Article 24 — Majorité simple" },
  { value: "ARTICLE_25", label: "Article 25 — Majorité absolue" },
  { value: "ARTICLE_26", label: "Article 26 — Double majorité" },
];

export { formatTantiemes };
