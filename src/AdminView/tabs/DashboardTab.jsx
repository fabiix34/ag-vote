import { ResultatsResolution } from "../../ResultatsResolution/ResultatsResolution";
import { formatTantiemes } from "../../hooks/formatTantieme";
import { calcPourcentage } from "../../hooks/calcPourcentage";
import { CoproprietairesTable } from "../../CoproprietairesTable/CoproprietairesTable";
import { isLive, isVoteAnticipe } from "../../utils/agStatut";

export function DashboardTab({ coproprietaires, resolutions, votes, agSession, pouvoirs = [] }) {
  const presents = coproprietaires.filter((c) => c.presence);
  const isEnCours = isLive(agSession?.statut);

  // Copros ayant déjà voté en anticipé (au moins une résolution)
  const idsAyantVoteAnticipe = isVoteAnticipe(agSession?.statut)
    ? [...new Set(votes.map((v) => v.coproprietaire_id))]
    : [];

  const totalTant = coproprietaires.reduce((s, c) => s + c.tantiemes, 0);
  const tantPresents = presents.reduce((s, c) => s + c.tantiemes, 0);

  // Tantièmes des mandants représentés par un mandataire présent (non double-comptés)
  const tantRepresentés = pouvoirs
    .filter((p) => presents.find((c) => c.id === p.mandataire_id))
    .map((p) => coproprietaires.find((c) => c.id === p.mandant_id))
    .filter((c) => c && !c.presence)
    .reduce((s, c) => s + c.tantiemes, 0);

  const tantQuorum = tantPresents + tantRepresentés;
  const quorum = calcPourcentage(tantQuorum, totalTant);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Résolutions restantes", value: resolutions.filter(r => r.statut !== "termine").length, sub: `${resolutions.filter(r => r.statut === "en_cours").length} en cours`, color: "text-blue-400" },
        ].map((k) => (
          <div key={k.label} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Quorum */}
      {isEnCours && <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-600 dark:text-zinc-400 font-medium">
            Quorum (présents + représentés)
          </span>
          <span className={`font-bold ${quorum >= 50 ? "text-emerald-400" : "text-amber-400"}`}>
            {formatTantiemes(tantQuorum)} / {formatTantiemes(totalTant)} — {quorum}%
          </span>
        </div>
        {tantRepresentés > 0 && (
          <p className="text-xs text-blue-500 dark:text-blue-400">
            dont {formatTantiemes(tantRepresentés)} tantièmes représentés par pouvoir
          </p>
        )}
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${quorum >= 50 ? "bg-emerald-500" : "bg-amber-500"}`}
            style={{ width: `${Math.min(quorum, 100)}%` }}
          />
        </div>
        {quorum < 50 && <p className="text-xs text-amber-400">⚠ Quorum insuffisant pour délibérer (50% requis)</p>}
      </div>}

      {/* Votes anticipés */}
      {isVoteAnticipe(agSession?.statut) && idsAyantVoteAnticipe.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-200 dark:border-blue-800/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
            <h3 className="font-medium text-blue-800 dark:text-blue-300 text-sm">Votes par correspondance reçus</h3>
            <span className="text-xs text-blue-500">{idsAyantVoteAnticipe.length} copropriétaire{idsAyantVoteAnticipe.length > 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-blue-100 dark:divide-blue-900/30 max-h-48 overflow-y-auto">
            {idsAyantVoteAnticipe.map((coproId) => {
              const copro = coproprietaires.find((c) => c.id === coproId);
              const nbVotes = votes.filter((v) => v.coproprietaire_id === coproId).length;
              return (
                <div key={coproId} className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm text-zinc-800 dark:text-zinc-200">
                    {copro ? `${copro.prenom} ${copro.nom}` : coproId.slice(0, 8)}
                  </span>
                  <span className="text-xs text-blue-500 font-medium">
                    {nbVotes} résolution{nbVotes > 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Liste des copropriétaires */}
      <CoproprietairesTable
        coproprietaires={coproprietaires}
        showPresence={true}
        agSessionId={agSession?.id}
        pouvoirs={pouvoirs}
        title="Liste des copropriétaires"
        subtitle={`${presents.length} présent${presents.length > 1 ? "s" : ""} / ${coproprietaires.length}`}
      />
    </div>
  );
}
