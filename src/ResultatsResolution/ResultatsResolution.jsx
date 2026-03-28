
// ============================================================
// COMPOSANT ADMIN : Résultats d'une résolution
// ============================================================
import { formatTantiemes } from "../hooks/formatTantieme.js";
import { calcPourcentage } from "../hooks/calcPourcentage.js";

export function ResultatsResolution({ resolution, votes }) {
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
    </div>
  );
}
