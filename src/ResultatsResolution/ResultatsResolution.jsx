
// ============================================================
// COMPOSANT ADMIN : Résultats d'une résolution
// ============================================================
import { useState } from "react";
import { formatTantiemes } from "../hooks/formatTantieme.js";
import { calcPourcentage } from "../hooks/calcPourcentage.js";
import { useRealtime } from "../hooks/useRealtime.js";
import { evaluateResolutionVotes, MAJORITY_RULE_SHORT } from "../utils/voteMajorityCalculator.js";

export function ResultatsResolution({ resolution, votes: initialVotes, coproprietaires = [] }) {
  const [votes, setVotes] = useState(initialVotes);

  useRealtime("votes", ({ eventType, new: newRow, old: oldRow }) => {
    setVotes((prev) => {
      if (eventType === "INSERT") return [...prev, newRow];
      if (eventType === "UPDATE") return prev.map((v) => (v.id === newRow.id ? newRow : v));
      if (eventType === "DELETE") return prev.filter((v) => v.id !== oldRow.id);
      return prev;
    });
  });

  const votesResolution = votes.filter((v) => v.resolution_id === resolution.id);
  const pour = votesResolution.filter((v) => v.choix === "pour");
  const contre = votesResolution.filter((v) => v.choix === "contre");
  const abstention = votesResolution.filter((v) => v.choix === "abstention");

  const tantPour = pour.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);
  const tantContre = contre.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);
  const tantAbst = abstention.reduce((s, v) => s + (v.tantiemes_poids || 0), 0);
  const tantTotal = tantPour + tantContre + tantAbst;

  const bars = [
    { label: "POUR", count: pour.length, tant: tantPour, color: "bg-emerald-500", pct: calcPourcentage(tantPour, tantTotal) },
    { label: "CONTRE", count: contre.length, tant: tantContre, color: "bg-red-500", pct: calcPourcentage(tantContre, tantTotal) },
    { label: "ABSTENTION", count: abstention.length, tant: tantAbst, color: "bg-zinc-500", pct: calcPourcentage(tantAbst, tantTotal) },
  ];

  // Calcul du verdict selon la règle de majorité de la résolution
  const verdict = resolution.majority_rule && coproprietaires.length > 0
    ? evaluateResolutionVotes(resolution, votes, coproprietaires)
    : null;

  const totalTantiemes = coproprietaires.reduce((s, c) => s + (c.tantiemes || 0), 0);

  return (
    <div className="space-y-3 mt-3">
      {bars.map((b) => (
        <div key={b.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">{b.label}</span>
            <span className="text-zinc-700 dark:text-zinc-300">{b.count} vote(s) · {formatTantiemes(b.tant)} tantièmes · {b.pct}%</span>
          </div>
          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${b.color} rounded-full transition-all duration-700`}
              style={{ width: `${b.pct}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-zinc-500 dark:text-zinc-500 text-right">{votesResolution.length} vote(s) sur {tantTotal} tantièmes exprimés</p>

      {/* Verdict de majorité */}
      {verdict && !verdict.undetermined && votesResolution.length > 0 && (
        <div className={`rounded-lg px-3 py-2.5 text-sm font-medium border ${
          verdict.passed
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-300"
        }`}>
          <p>
            {verdict.passed ? "✓ Résolution adoptée" : "✗ Résolution rejetée"} à la majorité de{" "}
            {MAJORITY_RULE_SHORT[resolution.majority_rule]}{" "}
            <span className="font-normal opacity-75">
              ({formatTantiemes(verdict.votesFor)} / {formatTantiemes(totalTantiemes)} tantièmes pour)
            </span>
          </p>
          {verdict.fallbackPossible && (
            <p className="mt-1 text-xs font-normal opacity-90">
              Un second vote à la majorité de {MAJORITY_RULE_SHORT[verdict.fallbackArticle]} est possible.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
