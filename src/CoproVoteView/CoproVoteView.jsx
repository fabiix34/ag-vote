import { useState, useEffect } from "react";
import { CheckCircle, XCircle, MinusCircle, LogOut, Vote, Check, Share2, Copy, UserCheck, X } from "lucide-react";
import { resolutionService, voteService, coproprietaireService, pouvoirService, pouvoirTokenService } from "../services/db";
import { useRealtime } from "../hooks/useRealtime";
import { formatTantiemes } from "../hooks/formatTantieme";
import { DocumentsSection } from "../DocumentSection/DocumentSection";

export function CoproVoteView({ profile, agSession, onLogout }) {
  const [resolutions, setResolutions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [totalTantiemes, setTotalTantiemes] = useState(0);
  const [pouvoirs, setPouvoirs] = useState([]);
  const [pouvoirDonne, setPouvoirDonne] = useState(null); // pouvoir où l'utilisateur est mandant
  const [, setVoting] = useState(null);
  const [justVoted, setJustVoted] = useState(null);

  // Donner mon pouvoir — génération de lien
  const [pouvoirLink, setPouvoirLink] = useState(null);
  const [showPouvoirModal, setShowPouvoirModal] = useState(false);
  const [generatingPouvoir, setGeneratingPouvoir] = useState(false);
  const [copied, setCopied] = useState(false);

  // Instructions de vote imposées au mandataire
  const [savingVoteImpose, setSavingVoteImpose] = useState(null); // resolution_id en cours de sauvegarde

  // Acceptation d'un pouvoir reçu via lien
  const [pendingToken, setPendingToken] = useState(null);
  const [acceptingPouvoir, setAcceptingPouvoir] = useState(false);

  useEffect(() => {
    if (!agSession?.id) return;
    Promise.all([
      resolutionService.fetchByAgSession(agSession.id),
      voteService.fetchByCopro(profile.id),
      coproprietaireService.fetchTantiemes(profile.copropriete_id),
      pouvoirService.fetchForMandataire(agSession.id, profile.id),
      pouvoirService.fetchDonne(agSession.id, profile.id),
    ]).then(([{ data: resols }, { data: myVotes }, { data: copros }, { data: pvrs }, { data: pdonne }]) => {
      setResolutions(resols || []);
      setVotes(myVotes || []);
      setPouvoirs(pvrs || []);
      setPouvoirDonne(pdonne || null);
      setTotalTantiemes((copros || []).reduce((s, c) => s + (c.tantiemes || 0), 0));
    });
  }, [agSession?.id]);

  // Vérification d'un token de pouvoir en attente (lien reçu)
  useEffect(() => {
    const token = sessionStorage.getItem("pending_pouvoir_token");
    if (!token || !agSession?.id) return;
    pouvoirTokenService.fetchPending(token, agSession.id).then(({ data }) => {
        if (data && data.mandant_id !== profile.id) {
          setPendingToken(data);
        } else {
          sessionStorage.removeItem("pending_pouvoir_token");
        }
      });
  }, [agSession?.id, profile.id]);

  // Mise à jour des pouvoirs en temps réel — notamment pour récupérer les votes_imposes
  // fixés par le mandant depuis son interface, sans quoi la vérification de cascade serait obsolète.
  useRealtime("pouvoirs", (payload) => {
    if (payload.new?.mandataire_id !== profile.id && payload.old?.mandataire_id !== profile.id) return;
    setPouvoirs((prev) => {
      if (payload.eventType === "UPDATE")
        // On merge pour préserver le champ mandant (jointure) absent du payload realtime
        return prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p));
      if (payload.eventType === "INSERT") return [...prev, payload.new];
      if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== payload.old.id);
      return prev;
    });
  });

  useRealtime("votes", (payload) => {
    if (payload.new?.coproprietaire_id !== profile.id && payload.old?.coproprietaire_id !== profile.id) return;
    setVotes((prev) => {
      if (payload.eventType === "INSERT") {
        const exists = prev.find((v) => v.resolution_id === payload.new.resolution_id);
        if (exists) return prev.map((v) => v.resolution_id === payload.new.resolution_id ? payload.new : v);
        return [...prev, payload.new];
      }
      if (payload.eventType === "UPDATE")
        return prev.map((v) => v.resolution_id === payload.new.resolution_id ? payload.new : v);
      if (payload.eventType === "DELETE")
        return prev.filter((v) => v.resolution_id !== payload.old.resolution_id);
      return prev;
    });
  });

  useRealtime("ag_sessions", (payload) => {
    if (payload.new?.id !== agSession?.id) return;
    if (payload.eventType === "UPDATE" && payload.new?.statut === "terminee") {
      onLogout();
    }
  });

  useRealtime("resolutions", (payload) => {
    if (payload.new?.ag_session_id !== agSession?.id && payload.old?.ag_session_id !== agSession?.id) return;
    setResolutions((prev) => {
      if (payload.eventType === "INSERT") return [...prev, payload.new].sort((a, b) => a.ordre - b.ordre);
      if (payload.eventType === "UPDATE") return prev.map((r) => r.id === payload.new.id ? payload.new : r);
      if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== payload.old.id);
      return prev;
    });
  });

  const handleVote = async (resolutionId, choix) => {
    if (pouvoirDonne) return;
    const resolution = resolutions.find((r) => r.id === resolutionId);
    if (resolution?.statut === "termine") return;

    const ops = [
      voteService.upsertAndReturn(profile.id, resolutionId, choix, profile.tantiemes),
      ...pouvoirs.flatMap((pouvoir) => {
        const mandant = pouvoir.mandant;
        if (!mandant) return [];
        // Si le mandant a fixé une instruction, son vote est déjà enregistré directement — on ne cascade pas
        if (pouvoir.votes_imposes?.[resolutionId]) return [];
        return [voteService.upsert(mandant.id, resolutionId, choix, mandant.tantiemes)];
      }),
    ];

    const [{ data: savedVote, error }] = await Promise.all(ops);

    if (!error) {
      const row = savedVote ?? { coproprietaire_id: profile.id, resolution_id: resolutionId, choix, tantiemes_poids: profile.tantiemes };
      setVotes((prev) => {
        const exists = prev.find((v) => v.resolution_id === resolutionId);
        if (exists) return prev.map((v) => v.resolution_id === resolutionId ? row : v);
        return [...prev, row];
      });
      setJustVoted({ id: resolutionId, choix });
      setTimeout(() => setJustVoted(null), 3000);
    }
    setVoting(null);
  };

  const handleGeneratePouvoir = async () => {
    if (!agSession?.id) return;
    setGeneratingPouvoir(true);
    // Récupère le token existant ou en crée un nouveau
    let { data: existing } = await pouvoirTokenService.fetchExisting(profile.id, agSession.id);
    if (!existing) {
      const { data: inserted } = await pouvoirTokenService.create(profile.id, agSession.id);
      existing = inserted;
    }

    if (existing) {
      setPouvoirLink(`${window.location.origin}/?pouvoir=${existing.token}`);
      setShowPouvoirModal(true);
    }
    setGeneratingPouvoir(false);
  };

  const handleCopyLink = () => {
    if (!pouvoirLink) return;
    navigator.clipboard.writeText(pouvoirLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator.share({ title: "Pouvoir AG", text: "Je vous donne mon pouvoir pour l'AG", url: pouvoirLink });
    } else {
      handleCopyLink();
    }
  };

  const handleAcceptPouvoir = async () => {
    if (!pendingToken) return;
    setAcceptingPouvoir(true);
    const { error } = await pouvoirService.create(pendingToken.mandant_id, profile.id, agSession.id);
    if (!error) {
      await pouvoirTokenService.markUsed(pendingToken.id);
      sessionStorage.removeItem("pending_pouvoir_token");
      setPendingToken(null);
      const { data: pvrs } = await pouvoirService.fetchForMandataire(agSession.id, profile.id);
      setPouvoirs(pvrs || []);
    }
    setAcceptingPouvoir(false);
  };

  const handleDeclinePouvoir = () => {
    sessionStorage.removeItem("pending_pouvoir_token");
    setPendingToken(null);
  };

  // Met à jour l'instruction de vote imposée au mandataire pour une résolution donnée
  // ET enregistre immédiatement le vote du mandant dans la table votes.
  // choix === null signifie "vote libre" : supprime l'instruction et le vote direct.
  const handleSetVoteImpose = async (resolutionId, choix) => {
    if (!pouvoirDonne?.id) return;
    setSavingVoteImpose(resolutionId);

    const updated = { ...(pouvoirDonne.votes_imposes || {}) };
    if (choix === null) {
      delete updated[resolutionId];
    } else {
      updated[resolutionId] = choix;
    }

    const ops = [
      pouvoirService.updateVotesImposes(pouvoirDonne.id, updated),
    ];

    if (choix !== null) {
      // Enregistre le vote directement — le mandataire ne cascadera pas pour ce mandant
      ops.push(voteService.upsert(profile.id, resolutionId, choix, profile.tantiemes));
    } else {
      // Supprime le vote direct pour que le mandataire puisse à nouveau voter librement pour ce mandant
      ops.push(voteService.delete(profile.id, resolutionId));
    }

    const [{ error }] = await Promise.all(ops);
    if (!error) {
      setPouvoirDonne((prev) => ({ ...prev, votes_imposes: updated }));
    }
    setSavingVoteImpose(null);
  };

  const voteButtons = [
    { choix: "pour", label: "POUR", icon: CheckCircle, color: "bg-emerald-600 hover:bg-emerald-500 border-emerald-600", activeColor: "ring-4 ring-emerald-500/40 bg-emerald-600" },
    { choix: "contre", label: "CONTRE", icon: XCircle, color: "bg-red-700 hover:bg-red-600 border-red-700", activeColor: "ring-4 ring-red-500/40 bg-red-700" },
    { choix: "abstention", label: "ABSTENTION", icon: MinusCircle, color: "bg-zinc-700 hover:bg-zinc-600 border-zinc-700", activeColor: "ring-4 ring-zinc-500/40 bg-zinc-700" },
  ];

  const votableResolutions = resolutions.filter((r) => {
    if (r.statut === "termine") return false;
    if (agSession?.vote_anticipe_actif) return true; // vote anticipé : toutes sauf terminées
    return r.statut === "en_cours"; // séance live : seulement celles lancées par le syndic
  });
  const closedVotes = votes.filter((v) => !votableResolutions.find((r) => r.id === v.resolution_id));

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Connecté en tant que</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{profile.prenom} {profile.nom}</p>
          <p className="text-xs text-zinc-500">{formatTantiemes(profile.tantiemes)} tantièmes</p>
          {pouvoirs.length > 0 && (
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
              Mandataire de {pouvoirs.map((p) => `${p.mandant?.prenom} ${p.mandant?.nom}`).join(", ")}
            </p>
          )}
        </div>
        <button onClick={onLogout} className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
          <LogOut size={18} />
        </button>
      </header>

      <main className="px-4 py-6 space-y-4 max-w-lg mx-auto">

        {/* Bannière d'acceptation de pouvoir reçu */}
        {pendingToken && (
          <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-800/50 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <UserCheck size={18} className="text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Pouvoir reçu</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  <span className="font-medium">{pendingToken.mandant?.prenom} {pendingToken.mandant?.nom}</span> vous délègue son vote pour cette AG
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAcceptPouvoir}
                disabled={acceptingPouvoir}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {acceptingPouvoir ? "Enregistrement..." : "Accepter"}
              </button>
              <button
                onClick={handleDeclinePouvoir}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium py-2 rounded-xl transition-colors"
              >
                Refuser
              </button>
            </div>
          </div>
        )}

        {/* Bannière pouvoir donné + instructions de vote */}
        {pouvoirDonne && (() => {
          // Résolutions pour lesquelles on peut encore donner des instructions (non clôturées)
          const instructables = resolutions.filter((r) => r.statut !== "termine");
          return (
            <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden">

              {/* En-tête */}
              <div className="flex items-start gap-3 p-4">
                <UserCheck size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Pouvoir délégué</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Vous avez donné votre pouvoir à{" "}
                    <span className="font-medium">{pouvoirDonne.mandataire?.prenom} {pouvoirDonne.mandataire?.nom}</span>.
                    Vous ne pouvez plus voter directement.
                  </p>
                </div>
              </div>

              {/* Instructions par résolution */}
              {instructables.length > 0 && (
                <div className="border-t border-amber-200 dark:border-amber-800/50 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                      Instructions pour votre mandataire
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Indiquez votre souhait par résolution. Sans instruction, votre mandataire vote librement.
                    </p>
                  </div>

                  {instructables.map((resolution) => {
                    const imposed = pouvoirDonne.votes_imposes?.[resolution.id] ?? null;
                    const isSaving = savingVoteImpose === resolution.id;

                    return (
                      <div key={resolution.id} className="bg-white/60 dark:bg-zinc-800/40 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-tight flex-1 min-w-0 truncate">
                            {resolution.titre}
                          </p>
                          {resolution.statut === "en_cours" && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">
                              En cours
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            {
                              choix: "pour",
                              label: "Pour",
                              active: "bg-emerald-600 text-white ring-2 ring-emerald-400/60",
                              idle: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/40",
                            },
                            {
                              choix: "contre",
                              label: "Contre",
                              active: "bg-red-600 text-white ring-2 ring-red-400/60",
                              idle: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40",
                            },
                            {
                              choix: "abstention",
                              label: "Abst.",
                              active: "bg-zinc-600 text-white ring-2 ring-zinc-400/60",
                              idle: "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600",
                            },
                            {
                              choix: null,
                              label: "Libre",
                              active: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-2 ring-blue-300/60",
                              idle: "bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700",
                            },
                          ].map(({ choix, label, active, idle }) => {
                            const isSelected = imposed === choix;
                            return (
                              <button
                                key={choix ?? "libre"}
                                disabled={isSaving}
                                onClick={() => handleSetVoteImpose(resolution.id, choix)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${isSelected ? active : idle}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                          {isSaving && (
                            <span className="text-[10px] text-zinc-400 self-center italic">Enregistrement…</span>
                          )}
                        </div>

                        {imposed && imposed !== null && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            Votre mandataire votera <span className="font-semibold text-zinc-700 dark:text-zinc-300">{imposed.toUpperCase()}</span> pour cette résolution.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Bouton Donner mon pouvoir */}
        {agSession && !pouvoirDonne && (
          <button
            onClick={handleGeneratePouvoir}
            disabled={generatingPouvoir}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Share2 size={16} />
            {generatingPouvoir ? "Génération..." : "Donner mon pouvoir à quelqu'un"}
          </button>
        )}

        {!agSession && (
          <div className="text-center py-12 space-y-2 bg-amber-500/5 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
            <p className="text-zinc-700 dark:text-zinc-300 font-medium text-sm">Aucune assemblée générale en cours</p>
            <p className="text-zinc-500 text-xs">Votre syndic n'a pas encore démarré d'AG</p>
          </div>
        )}

        {agSession && votableResolutions.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto">
              <Vote size={28} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            {agSession.statut === "planifiee" ? (
              <>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">L'AG n'a pas encore démarré</p>
                <p className="text-zinc-500 text-sm">Vous serez notifié dès l'ouverture du vote</p>
              </>
            ) : (
              <>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">En attente d'un vote</p>
                <p className="text-zinc-500 text-sm">Le syndic n'a pas encore lancé de résolution</p>
              </>
            )}
            <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Synchronisation temps réel active
            </div>
          </div>
        )}

        {votableResolutions.map((resolution) => {
          const voted = votes.find((v) => v.resolution_id === resolution.id);
          const isJustVoted = justVoted?.id === resolution.id;
          return (
            <div key={resolution.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">Vote ouvert</span>
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">{resolution.titre}</h2>
                {resolution.description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{resolution.description}</p>}
                {resolution.montant != null && resolution.montant !== -1 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-mono font-medium">
                      Total : {resolution.montant.toLocaleString("fr-FR")} €
                    </span>
                    {totalTantiemes > 0 && (
                      <span className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-mono font-medium">
                        Votre quote-part :{" "}
                        {((profile.tantiemes / totalTantiemes) * resolution.montant).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                      </span>
                    )}
                  </div>
                )}
              </div>

              <DocumentsSection resolutionId={resolution.id} canManage={false} />

              {isJustVoted && (
                <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
                  <Check size={16} className="text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">Vote enregistré !</span>
                </div>
              )}

              <div className="p-4 space-y-3">
                {pouvoirDonne ? (
                  <p className="text-xs text-amber-500 text-center py-2">Vote délégué à {pouvoirDonne.mandataire?.prenom} {pouvoirDonne.mandataire?.nom}</p>
                ) : (
                  <>
                    {voted && !isJustVoted && (
                      <p className="text-xs text-zinc-500 text-center mb-2">Vote enregistré · Vous pouvez modifier votre choix</p>
                    )}
                  </>
                )}
                {!pouvoirDonne && voteButtons.map((btn) => {
                  const isSelected = voted?.choix === btn.choix;
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.choix}
                      onClick={() => handleVote(resolution.id, btn.choix)}
                      className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base text-white border transition-all active:scale-95 disabled:opacity-70 ${isSelected ? btn.activeColor : btn.color}`}
                    >
                      <Icon size={22} />
                      {btn.label}
                      {isSelected && <Check size={18} className="ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {closedVotes.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Votes clôturés</h3>
            {closedVotes.map((v) => {
              const res = resolutions.find((r) => r.id === v.resolution_id);
              return (
                <div key={v.id} className="flex items-center justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400 text-xs truncate max-w-[60%]">
                    {res?.titre ?? `#${v.resolution_id.slice(0, 8)}`}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v.choix === "pour" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : v.choix === "contre" ? "bg-red-500/20 text-red-600 dark:text-red-400"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}>
                    {v.choix.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal lien de pouvoir */}
      {showPouvoirModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setShowPouvoirModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-zinc-900 dark:text-white">Donner mon pouvoir</h2>
              <button
                onClick={() => setShowPouvoirModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Partagez ce lien à la personne qui votera en votre nom. Elle devra se connecter à son espace pour accepter le pouvoir.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl p-3 text-xs text-zinc-600 dark:text-zinc-400 break-all font-mono">
              {pouvoirLink}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                <Copy size={15} />
                {copied ? "Copié !" : "Copier"}
              </button>
              <button
                onClick={handleShareLink}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                <Share2 size={15} />
                Partager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
