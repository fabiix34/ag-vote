
import { useState } from "react";
import { CheckCircle, Edit3, Hand, Play, Trash2 } from "lucide-react";
import { voteService, resolutionService } from "../services/db";
import { StatutBadge } from "../StatutBadge/StatutBadge";
import { ResultatsResolution } from "../ResultatsResolution/ResultatsResolution";
import { DocumentsSection } from "../DocumentSection/DocumentSection";

export function ResolutionCard({ resolution, votes, coproprietaires, pouvoirs = [], canModifyAgenda = false, canEditResolution = false, canLaunchVote = false, showAnticipeResults = false, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [titre, setTitre] = useState(resolution.titre);
  const [description, setDescription] = useState(resolution.description || "");
  const [loading, setLoading] = useState(false);
  const [showMainLevee, setShowMainLevee] = useState(false);
  const [votingFor, setVotingFor] = useState(null);

  const votesForResolution = votes.filter((v) => v.resolution_id === resolution.id);
  const votedIds = new Set(votesForResolution.map((v) => v.coproprietaire_id));
  const notVotedYet = coproprietaires.filter((c) => !votedIds.has(c.id));

  const handleVoteForCopro = async (copro, choix) => {
    setVotingFor(`${copro.id}-${choix}`);

    const existingVote = votes.find((v) => v.coproprietaire_id === copro.id && v.resolution_id === resolution.id);
    const mainVoteOp = existingVote?.id
      ? voteService.update(existingVote.id, choix, copro.tantiemes)
      : voteService.insert(copro.id, resolution.id, choix, copro.tantiemes);

    const voteOps = [mainVoteOp];

    // Cascade : voter aussi pour les mandants de ce copropriétaire
    const mandants = pouvoirs.filter((p) => p.mandataire_id === copro.id);
    for (const pouvoir of mandants) {
      const mandant = coproprietaires.find((c) => c.id === pouvoir.mandant_id);
      if (!mandant) continue;
      // Si le mandant a fixé une instruction, son vote est déjà enregistré directement — on ne cascade pas
      if (pouvoir.votes_imposes?.[resolution.id]) continue;
      voteOps.push(voteService.upsert(mandant.id, resolution.id, choix, mandant.tantiemes));
    }

    await Promise.all(voteOps);
    setVotingFor(null);
  };

  const handleStatutChange = async (statut) => {
    setLoading(true);
    if (statut === "en_cours") await resolutionService.pauseOthers();
    await resolutionService.updateStatut(resolution.id, statut);
    setLoading(false);
    onUpdate();
  };

  const handleSave = async () => {
    await resolutionService.update(resolution.id, { titre, description });
    setEditing(false);
    onUpdate();
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${
      resolution.statut === "en_cours"
        ? "border-emerald-500 bg-emerald-500/5"
        : "bg-[var(--bg)] border-zinc-200 dark:border-zinc-800"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
              <textarea
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-emerald-500 resize-none"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg">Sauvegarder</button>
                <button onClick={() => setEditing(false)} className="text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-lg">Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm leading-tight">{resolution.titre}</h3>
              {resolution.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{resolution.description}</p>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatutBadge statut={resolution.statut} />
          {canEditResolution && resolution.statut === "en_attente" && (
            <button onClick={() => setEditing(!editing)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Edit3 size={14} />
            </button>
          )}
          {canModifyAgenda && resolution.statut === "en_attente" && (
            <button onClick={() => onDelete(resolution.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Documents */}
      <DocumentsSection resolutionId={resolution.id} canManage={canModifyAgenda && resolution.statut === "en_attente"} />

      {/* Résultats si votes */}
      {(resolution.statut === "en_cours" || resolution.statut === "termine" || showAnticipeResults) && (
        <ResultatsResolution resolution={resolution} votes={votes} coproprietaires={coproprietaires} />
      )}

      {/* Vote à main levée */}
      {resolution.statut === "en_cours" && (
        <div className="border border-amber-200 dark:border-amber-800/50 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowMainLevee((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Hand size={12} />
              Vote à main levée
              {notVotedYet.length > 0 && (
                <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-300 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                  {notVotedYet.length} n'ont pas voté
                </span>
              )}
            </span>
            <span className="text-amber-400">{showMainLevee ? "▲" : "▼"}</span>
          </button>

          {showMainLevee && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {notVotedYet.length === 0 ? (
                <p className="px-3 py-3 text-xs text-zinc-500 text-center">Tous les copropriétaires ont voté.</p>
              ) : (
                notVotedYet.map((copro) => (
                  <div key={copro.id} className="px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">
                        {copro.prenom} {copro.nom}
                        <span className="text-xs text-zinc-400 ml-1">({copro.tantiemes} tants.)</span>
                      </span>
                      {(() => {
                        const mandants = pouvoirs.filter((p) => p.mandataire_id === copro.id);
                        if (!mandants.length) return null;
                        return (
                          <p className="text-[11px] text-blue-500 dark:text-blue-400">
                            + pouvoir de {mandants.map((p) => {
                              const m = coproprietaires.find((c) => c.id === p.mandant_id);
                              return m ? `${m.prenom} ${m.nom}` : "—";
                            }).join(", ")}
                          </p>
                        );
                      })()}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {[
                        { choix: "pour", label: "Pour", cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/50" },
                        { choix: "contre", label: "Contre", cls: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/50" },
                        { choix: "abstention", label: "Abst.", cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700" },
                      ].map(({ choix, label, cls }) => (
                        <button
                          key={choix}
                          onClick={() => handleVoteForCopro(copro, choix)}
                          disabled={votingFor !== null}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${cls}`}
                        >
                          {votingFor === `${copro.id}-${choix}` ? "..." : label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2 pt-1">
          {canLaunchVote && resolution.statut === "en_attente" && (
            <button
              onClick={() => handleStatutChange("en_cours")}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Play size={12} /> Lancer le vote
            </button>
          )}
          {resolution.statut === "en_cours" && (
            <button
              onClick={() => handleStatutChange("termine")}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={12} /> Clôturer
            </button>
          )}
          {resolution.statut === "termine" && (
            <span className="text-xs text-zinc-500 italic">Vote clôturé</span>
          )}
        </div>
      )}
    </div>
  );
}