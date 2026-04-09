// ============================================================
// VOTE LIVE PANEL — Saisie par exception en séance (syndic)
// ============================================================
// Logique :
//   • Affiche tous les copropriétaires éligibles (présents + leurs mandants)
//   • Défaut POUR (ou CONTRE si mode inversé) → syndic ne clique que les exceptions
//   • Vote immédiat au clic via submitManualSyndic (RPC atomique + audit_log)
//   • Instructions verrouillées (votes_imposes) : cadenas, non modifiables
//   • Mandants libres : suivent leur mandataire en temps réel
//   • "Valider et clôturer" : soumet tous les votes en attente + ferme la résolution
// ============================================================

import { useMemo, useState } from "react";
import { Lock, Shuffle, CheckCircle, ChevronRight, Users, Vote } from "lucide-react";
import { voteService } from "../services/db";
import { formatTantiemes } from "../hooks/formatTantieme";
import { CoproprietairesTable } from "../CoproprietairesTable/CoproprietairesTable";

export function VoteLivePanel({ resolution, votes, coproprietaires, pouvoirs, syndicId, onCloseVote, onPresenceUpdate }) {
  const [activeTab, setActiveTab] = useState("vote");
  const [invertMode, setInvertMode] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [finalizing, setFinalizing] = useState(false);

  // ── Pouvoirs actifs pour cette séance ────────────────────────────────────
  const activePouvoirs = useMemo(
    () => pouvoirs.filter((p) => ["active", "scheduled_stop"].includes(p.statut)),
    [pouvoirs]
  );

  // ── Votes déjà soumis pour cette résolution (mis à jour en temps réel) ───
  const votesForRes = useMemo(
    () => votes.filter((v) => v.resolution_id === resolution.id),
    [votes, resolution.id]
  );
  const votedIds = useMemo(
    () => new Set(votesForRes.map((v) => v.coproprietaire_id)),
    [votesForRes]
  );

  // ── Liste des votants éligibles : copros présents + leurs mandants ────────
  // Un copro éligible = présent en séance (presence === true).
  // Ses mandants (absent·es ayant donné pouvoir) apparaissent en sous-ligne.
  const eligibleVoters = useMemo(() => {
    return coproprietaires
      .filter((c) => c.presence)
      .map((copro) => {
        const myPouvoirs = activePouvoirs.filter((p) => p.mandataire_id === copro.id);
        const mandants = myPouvoirs
          .map((pouvoir) => {
            const mandantCopro = coproprietaires.find((c) => c.id === pouvoir.mandant_id);
            if (!mandantCopro) return null;
            // Instruction imposée par le mandant pour CETTE résolution
            const instruction = pouvoir.votes_imposes?.[resolution.id] ?? null;
            return {
              ...mandantCopro,
              instruction,
              isLocked: !!instruction,
              pouvoirId: pouvoir.id,
            };
          })
          .filter(Boolean);
        return { ...copro, mandants };
      });
  }, [coproprietaires, activePouvoirs, resolution.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getDbVote = (coproId) =>
    votesForRes.find((v) => v.coproprietaire_id === coproId)?.choix ?? null;

  const defaultChoix = invertMode ? "contre" : "pour";

  // Vote effectif affiché : DB > instruction > défaut du mode
  const getEffectiveVote = (coproId, instruction = null) => {
    if (instruction) return instruction;
    return getDbVote(coproId) ?? defaultChoix;
  };

  // ── Score en temps réel ──────────────────────────────────────────────────
  // Inclut DB votes + instructions verrouillées non encore soumises + pending
  const score = useMemo(() => {
    let pour = 0, contre = 0, abstention = 0, pending = 0;
    const allPersons = eligibleVoters.flatMap((v) => [v, ...v.mandants]);
    for (const person of allPersons) {
      const t = person.tantiemes || 0;
      const dbVote = getDbVote(person.id);
      if (dbVote) {
        if (dbVote === "pour") pour += t;
        else if (dbVote === "contre") contre += t;
        else if (dbVote === "abstention") abstention += t;
      } else if (person.isLocked && person.instruction) {
        // Instruction pré-enregistrée : déjà comptée comme certaine
        if (person.instruction === "pour") pour += t;
        else if (person.instruction === "contre") contre += t;
        else if (person.instruction === "abstention") abstention += t;
      } else {
        pending += t;
      }
    }
    return { pour, contre, abstention, pending };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleVoters, votedIds, votesForRes]);

  const totalEligible = score.pour + score.contre + score.abstention + score.pending;
  const pct = (n) => (totalEligible > 0 ? Math.round((n / totalEligible) * 100) : 0);

  // Nombre de votes non encore saisis (hors instructions verrouillées)
  const pendingCount = eligibleVoters
    .flatMap((v) => [v, ...v.mandants.filter((m) => !m.isLocked)])
    .filter((p) => !votedIds.has(p.id)).length;

  // ── Vote immédiat sur clic du syndic ─────────────────────────────────────
  const handleVote = async (voter, choix) => {
    if (submittingId || finalizing) return;
    setSubmittingId(voter.id);

    // Mandants libres (sans instruction) qui suivent ce mandataire
    const freeMandantIds = (voter.mandants ?? [])
      .filter((m) => !m.isLocked)
      .map((m) => m.id);

    await voteService.submitManualSyndic(
      syndicId,
      voter.id,
      resolution.id,
      choix,
      freeMandantIds,
      { source: "live_panel" }
    );
    setSubmittingId(null);
  };

  // ── Validation finale : soumet les votes en attente puis clôture ─────────
  const handleFinalize = async () => {
    setFinalizing(true);

    // Lecture fraîche des votes en DB pour éviter la race condition :
    // un copro peut avoir voté depuis son espace juste avant la clôture,
    // son event realtime n'ayant pas encore atteint ce composant.
    const { data: freshVotes } = await voteService.fetchByResolutions([resolution.id]);
    const freshVotedIds = new Set((freshVotes || []).map((v) => v.coproprietaire_id));

    const promises = [];

    for (const voter of eligibleVoters) {
      // Mandants libres non encore soumis (peut arriver si pouvoir ajouté après un VPC)
      const freePendingMandantIds = voter.mandants
        .filter((m) => !m.isLocked && !freshVotedIds.has(m.id))
        .map((m) => m.id);

      if (!freshVotedIds.has(voter.id)) {
        // Voter non soumis → soumettre avec le défaut + cascade mandants libres
        promises.push(
          voteService.submitManualSyndic(
            syndicId,
            voter.id,
            resolution.id,
            defaultChoix,
            freePendingMandantIds,
            { source: "live_panel_finalize" }
          )
        );
      } else if (freePendingMandantIds.length > 0) {
        // Voter déjà soumis mais mandants libres orphelins → soumettre séparément
        for (const mId of freePendingMandantIds) {
          promises.push(
            voteService.submitManualSyndic(
              syndicId,
              mId,
              resolution.id,
              defaultChoix,
              [],
              { source: "live_panel_finalize_orphan" }
            )
          );
        }
      }

      // Instructions verrouillées non encore soumises → exécuter l'instruction
      for (const m of voter.mandants.filter((m) => m.isLocked && !freshVotedIds.has(m.id))) {
        promises.push(
          voteService.submitManualSyndic(
            syndicId,
            m.id,
            resolution.id,
            m.instruction,
            [],
            { source: "live_panel_finalize_instruction" }
          )
        );
      }
    }

    await Promise.all(promises);
    setFinalizing(false);
    onCloseVote();
  };

  // ── Copros triés pour la liste des présences ─────────────────────────────
  const sortedCopros = useMemo(
    () => [...coproprietaires].sort((a, b) => {
      if (a.presence !== b.presence) return b.presence ? 1 : -1;
      return a.nom.localeCompare(b.nom);
    }),
    [coproprietaires]
  );

  const totalTantiemesPresents = useMemo(
    () => coproprietaires.filter((c) => c.presence).reduce((sum, c) => sum + (c.tantiemes || 0), 0),
    [coproprietaires]
  );


  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Onglets ── */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("vote")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
            activeTab === "vote"
              ? "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Vote size={12} />
          Vote en séance
        </button>
        <button
          onClick={() => setActiveTab("presences")}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all ${
            activeTab === "presences"
              ? "bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Users size={12} />
          Présences
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            activeTab === "presences"
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
              : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
          }`}>
            {coproprietaires.filter((c) => c.presence).length}
          </span>
        </button>
      </div>

      {/* ── Onglet : Liste des présences ── */}
      {activeTab === "presences" && (
        <div className="space-y-3">
          {/* Récapitulatif */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {coproprietaires.filter((c) => c.presence).length}
              </span>{" "}
              présent{coproprietaires.filter((c) => c.presence).length > 1 ? "s" : ""} sur{" "}
              {coproprietaires.length} copropriétaires
            </div>
            <div className="text-xs text-zinc-500">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                {formatTantiemes(totalTantiemesPresents)}
              </span>{" "}
              tantièmes représentés
            </div>
          </div>

          <CoproprietairesTable
            coproprietaires={sortedCopros}
            showPresence
            agSessionId={resolution.ag_session_id}
            onMutate={onPresenceUpdate}
          />
        </div>
      )}

      {/* ── Onglet : Vote en séance ── */}
      {activeTab === "vote" && (
      <div className="space-y-3">

      {/* ── Barre de score ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2.5">
        <div className="flex justify-between items-baseline text-xs text-zinc-500 mb-0.5">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Résultat en temps réel</span>
          <span>{formatTantiemes(totalEligible)} tantièmes éligibles</span>
        </div>

        {/* Barre segmentée */}
        <div className="h-5 rounded-full overflow-hidden flex bg-zinc-100 dark:bg-zinc-800">
          {totalEligible > 0 && (
            <>
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${pct(score.pour)}%` }}
                title={`Pour : ${formatTantiemes(score.pour)}`}
              />
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${pct(score.contre)}%` }}
                title={`Contre : ${formatTantiemes(score.contre)}`}
              />
              <div
                className="h-full bg-zinc-400 transition-all duration-500"
                style={{ width: `${pct(score.abstention)}%` }}
                title={`Abstention : ${formatTantiemes(score.abstention)}`}
              />
              {/* Pending : représente les votes pas encore saisis */}
              <div
                className="h-full bg-zinc-200 dark:bg-zinc-700 transition-all duration-500"
                style={{ width: `${pct(score.pending)}%` }}
                title={`En attente : ${formatTantiemes(score.pending)}`}
              />
            </>
          )}
        </div>

        {/* Légende */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            POUR — {formatTantiemes(score.pour)} ({pct(score.pour)}%)
          </span>
          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            CONTRE — {formatTantiemes(score.contre)} ({pct(score.contre)}%)
          </span>
          <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
            ABST. — {formatTantiemes(score.abstention)} ({pct(score.abstention)}%)
          </span>
          {score.pending > 0 && (
            <span className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-600">
              <span className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
              En attente — {formatTantiemes(score.pending)}
            </span>
          )}
        </div>
      </div>

      {/* ── Contrôles ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setInvertMode((v) => !v)}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
            invertMode
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          <Shuffle size={12} />
          {invertMode ? "Mode inversé actif (défaut : CONTRE)" : "Basculer tout en CONTRE"}
        </button>
        {pendingCount > 0 && (
          <span className="text-xs text-zinc-400">
            {pendingCount} vote{pendingCount > 1 ? "s" : ""} non saisis — défaut :{" "}
            <strong className={invertMode ? "text-red-500" : "text-emerald-500"}>
              {defaultChoix.toUpperCase()}
            </strong>
          </span>
        )}
      </div>

      {/* ── Liste des votants ── */}
      <CoproprietairesTable
        coproprietaires={eligibleVoters}
        hideEmail
        emptyMessage="Aucun copropriétaire présent en séance."
        renderNameExtra={(voter) => (
          <>
            {voter.mandants?.length > 0 && (
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                {voter.mandants.length} pouvoir{voter.mandants.length > 1 ? "s" : ""}
              </span>
            )}
            {(() => {
              const dbVote = getDbVote(voter.id);
              const isVoted = votedIds.has(voter.id);
              if (isVoted && dbVote) return (
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  dbVote === "pour" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : dbVote === "contre" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>✓ {dbVote}</span>
              );
              return <span className="text-[10px] text-zinc-300 dark:text-zinc-600 italic">défaut : {defaultChoix}</span>;
            })()}
          </>
        )}
        extraColumns={[{
          header: "Vote",
          cell: (voter) => {
            const dbVote = getDbVote(voter.id);
            const effectiveVote = getEffectiveVote(voter.id);
            const isVoted = votedIds.has(voter.id);
            const isLoading = submittingId === voter.id;
            return (
              <div className="flex gap-1 justify-end">
                {[
                  { choix: "pour",       label: "Pour",   active: "bg-emerald-500 text-white shadow-sm", inactive: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50", pending: "bg-emerald-100/70 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-500 ring-1 ring-inset ring-emerald-300 dark:ring-emerald-800" },
                  { choix: "contre",     label: "Contre", active: "bg-red-500 text-white shadow-sm",     inactive: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50",         pending: "bg-red-100/70 dark:bg-red-900/20 text-red-600 dark:text-red-500 ring-1 ring-inset ring-red-300 dark:ring-red-800" },
                  { choix: "abstention", label: "Abst.",  active: "bg-zinc-500 text-white shadow-sm",    inactive: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700",           pending: "bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-500 ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700" },
                ].map(({ choix, label, active, inactive, pending }) => {
                  const isActive  = isVoted && dbVote === choix;
                  const isPending = !isVoted && effectiveVote === choix;
                  return (
                    <button
                      key={choix}
                      onClick={(e) => { e.stopPropagation(); handleVote(voter, choix); }}
                      disabled={isLoading || finalizing}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all disabled:opacity-50 ${isActive ? active : isPending ? pending : inactive}`}
                    >
                      {isLoading ? "…" : label}
                    </button>
                  );
                })}
              </div>
            );
          },
        }]}
        renderSubRows={(voter) =>
          voter.mandants?.map((mandant) => {
            const mandantDbVote = getDbVote(mandant.id);
            const mandantVoted  = votedIds.has(mandant.id);
            return (
              <tr key={mandant.id} className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-black/10">
                <td colSpan={99} className="px-3 py-1.5 pl-8">
                  <div className="flex items-center gap-2">
                    <ChevronRight size={10} className="text-zinc-300 dark:text-zinc-700 shrink-0" />
                    {mandant.isLocked
                      ? <Lock size={10} className="text-amber-500 shrink-0" title="Vote verrouillé par instruction" />
                      : <div className="w-2 h-2 rounded-full border border-dashed border-blue-300 dark:border-blue-700 shrink-0" title="Suit le vote de son mandataire" />
                    }
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{mandant.prenom} {mandant.nom}</span>
                    <span className="text-[10px] text-zinc-400">{formatTantiemes(mandant.tantiemes)} tants.</span>
                    {mandant.isLocked
                      ? <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ml-1 ${
                          mandant.instruction === "pour" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : mandant.instruction === "contre" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                        }`}>Instruction : {mandant.instruction}</span>
                      : <span className="text-[10px] text-blue-400 dark:text-blue-500 italic ml-1">suit {voter.prenom}</span>
                    }
                    {mandantVoted && mandantDbVote && (
                      <span className={`text-[10px] font-bold ml-auto ${mandantDbVote === "pour" ? "text-emerald-500" : mandantDbVote === "contre" ? "text-red-500" : "text-zinc-400"}`}>✓</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })
        }
      />

      {/* ── Pied : validation finale ── */}
      <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-400">
          {pendingCount > 0
            ? `${pendingCount} vote${pendingCount > 1 ? "s" : ""} non saisis → enregistrés en ${defaultChoix.toUpperCase()} à la clôture`
            : "Tous les votes ont été enregistrés."}
        </p>
        <button
          onClick={handleFinalize}
          disabled={finalizing}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors shrink-0"
        >
          <CheckCircle size={14} />
          {finalizing ? "Finalisation…" : "Valider et clôturer"}
        </button>
      </div>

      </div>
      )}

    </div>
  );
}
