import { ResultatsResolution } from "../../ResultatsResolution/ResultatsResolution";
import { formatTantiemes } from "../../hooks/formatTantieme";
import { calcPourcentage } from "../../hooks/calcPourcentage";

export function DashboardTab({ coproprietaires, resolutions, votes }) {
  const presents = coproprietaires.filter((c) => c.presence);
  const totalTant = coproprietaires.reduce((s, c) => s + c.tantiemes, 0);
  const tantPresents = presents.reduce((s, c) => s + c.tantiemes, 0);
  const quorum = calcPourcentage(tantPresents, totalTant);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Copropriétaires", value: coproprietaires.length, sub: "total", color: "text-zinc-300" },
          { label: "Présents", value: presents.length, sub: `${quorum}% des tantièmes`, color: "text-emerald-400" },
          { label: "Résolutions", value: resolutions.length, sub: `${resolutions.filter(r => r.statut === "en_cours").length} en cours`, color: "text-blue-400" },
          { label: "Votes exprimés", value: votes.length, sub: "total", color: "text-amber-400" },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Quorum */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-600 dark:text-zinc-400 font-medium">Quorum (tantièmes présents)</span>
          <span className={`font-bold ${quorum >= 50 ? "text-emerald-400" : "text-amber-400"}`}>
            {formatTantiemes(tantPresents)} / {formatTantiemes(totalTant)} — {quorum}%
          </span>
        </div>
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${quorum >= 50 ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(quorum, 100)}%` }}
          />
        </div>
        {quorum < 50 && <p className="text-xs text-amber-400">⚠ Quorum insuffisant pour délibérer (50% requis)</p>}
      </div>

      {/* Live votes pour résolution en cours */}
      {resolutions.filter(r => r.statut === "en_cours").map((r) => (
        <div key={r.id} className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Vote en cours : {r.titre}</h3>
          </div>
          <ResultatsResolution resolution={r} votes={votes} coproprietaires={coproprietaires} />
        </div>
      ))}

      {/* Liste des présents */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-medium text-zinc-900 dark:text-white text-sm">Présents en séance</h3>
          <span className="text-xs text-zinc-500">{presents.length} connectés</span>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
          {presents.length === 0 ? (
            <p className="px-4 py-8 text-center text-zinc-500 text-sm">Aucun copropriétaire connecté</p>
          ) : presents.map((c) => (
            <div key={c.id} className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{c.prenom} {c.nom}</span>
              </div>
              <span className="text-xs text-zinc-500 font-mono">{formatTantiemes(c.tantiemes)} tants.</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
