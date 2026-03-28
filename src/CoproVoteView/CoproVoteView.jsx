// ============================================================
// VUE COPROPRIÉTAIRE : Vote
// ============================================================

import { useState, useCallback, useEffect } from "react";
import { CheckCircle, XCircle, MinusCircle, LogOut, Vote, Check } from "lucide-react";
import { supabase } from "../App";
import { useRealtime } from "../hooks/useRealtime";
import { formatTantiemes } from "../hooks/formatTantieme";
import { DocumentsSection } from "../DocumentSection/DocumentSection";

export function CoproVoteView({ profile, agSession, onLogout }) {
  const [resolutions, setResolutions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [totalTantiemes, setTotalTantiemes] = useState(0);
  const [voting, setVoting] = useState(null);
  const [justVoted, setJustVoted] = useState(null);

  const fetchData = useCallback(async () => {
    // Filtre par ag_session_id si on a une session active
    const resolsQuery = supabase
      .from("resolutions")
      .select("*")
      .eq("statut", "en_cours");
    if (agSession?.id) {
      resolsQuery.eq("ag_session_id", agSession.id);
    }

    // Total tantièmes de la même copropriété
    const coprosQuery = agSession?.id
      ? supabase
          .from("coproprietaires")
          .select("tantiemes")
          .eq("copropriete_id", profile.copropriete_id)
      : supabase.from("coproprietaires").select("tantiemes");

    const [{ data: resols }, { data: myVotes }, { data: copros }] = await Promise.all([
      resolsQuery,
      supabase.from("votes").select("*").eq("coproprietaire_id", profile.id),
      coprosQuery,
    ]);

    setResolutions(resols || []);
    setVotes(myVotes || []);
    setTotalTantiemes((copros || []).reduce((s, c) => s + (c.tantiemes || 0), 0));
  }, [profile.id, profile.copropriete_id, agSession?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime : surveiller les résolutions de cette AG
  useRealtime(
    "resolutions",
    useCallback(
      (payload) => {
        setResolutions((prev) => {
          const isForThisAG =
            !agSession?.id || payload.new?.ag_session_id === agSession.id;

          if (payload.new?.statut === "en_cours" && isForThisAG) {
            const exists = prev.find((r) => r.id === payload.new.id);
            if (exists) return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
            return [...prev, payload.new];
          }
          return prev.filter(
            (r) => r.id !== payload.new?.id && r.id !== payload.old?.id
          );
        });
      },
      [agSession?.id]
    )
  );

  const handleVote = async (resolutionId, choix) => {
    setVoting(resolutionId);
    const { error } = await supabase.from("votes").upsert(
      {
        coproprietaire_id: profile.id,
        resolution_id: resolutionId,
        choix,
        tantiemes_poids: profile.tantiemes,
      },
      { onConflict: "coproprietaire_id,resolution_id" }
    );

    if (!error) {
      setVotes((prev) => {
        const exists = prev.find((v) => v.resolution_id === resolutionId);
        if (exists)
          return prev.map((v) =>
            v.resolution_id === resolutionId ? { ...v, choix } : v
          );
        return [
          ...prev,
          {
            coproprietaire_id: profile.id,
            resolution_id: resolutionId,
            choix,
            tantiemes_poids: profile.tantiemes,
          },
        ];
      });
      setJustVoted({ id: resolutionId, choix });
      setTimeout(() => setJustVoted(null), 3000);
    }
    setVoting(null);
  };

  const monVote = (resolutionId) => votes.find((v) => v.resolution_id === resolutionId);

  const voteButtons = [
    {
      choix: "pour",
      label: "POUR",
      icon: CheckCircle,
      color: "bg-emerald-600 hover:bg-emerald-500 border-emerald-600",
      activeColor: "ring-4 ring-emerald-500/40 bg-emerald-600",
    },
    {
      choix: "contre",
      label: "CONTRE",
      icon: XCircle,
      color: "bg-red-700 hover:bg-red-600 border-red-700",
      activeColor: "ring-4 ring-red-500/40 bg-red-700",
    },
    {
      choix: "abstention",
      label: "ABSTENTION",
      icon: MinusCircle,
      color: "bg-zinc-700 hover:bg-zinc-600 border-zinc-700",
      activeColor: "ring-4 ring-zinc-500/40 bg-zinc-700",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500">Connecté en tant que</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            {profile.prenom} {profile.nom}
          </p>
          <p className="text-xs text-zinc-500">{formatTantiemes(profile.tantiemes)} tantièmes</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="px-4 py-6 space-y-4 max-w-lg mx-auto">
        {/* Pas d'AG active */}
        {!agSession && (
          <div className="text-center py-12 space-y-2 bg-amber-500/5 border border-amber-200 dark:border-amber-800/40 rounded-2xl">
            <p className="text-zinc-700 dark:text-zinc-300 font-medium text-sm">
              Aucune assemblée générale en cours
            </p>
            <p className="text-zinc-500 text-xs">
              Votre syndic n'a pas encore démarré d'AG
            </p>
          </div>
        )}

        {/* En attente de résolution */}
        {agSession && resolutions.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto">
              <Vote size={28} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            <div>
              <p className="text-zinc-700 dark:text-zinc-300 font-medium">En attente d'un vote</p>
              <p className="text-zinc-500 text-sm mt-1">
                Le syndic n'a pas encore lancé de résolution
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Synchronisation temps réel active
            </div>
          </div>
        )}

        {/* Résolutions en cours */}
        {resolutions.map((resolution) => {
          const voted = monVote(resolution.id);
          const isJustVoted = justVoted?.id === resolution.id;

          return (
            <div
              key={resolution.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden"
            >
              {/* En-tête résolution */}
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wider">
                    Vote en cours
                  </span>
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">
                  {resolution.titre}
                </h2>
                {resolution.description && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {resolution.description}
                  </p>
                )}
                {resolution.montant != null && resolution.montant !== -1 && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-mono font-medium">
                      Total : {resolution.montant.toLocaleString("fr-FR")} €
                    </span>
                    {totalTantiemes > 0 && (
                      <span className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-mono font-medium">
                        Votre quote-part :{" "}
                        {(
                          (profile.tantiemes / totalTantiemes) *
                          resolution.montant
                        ).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
                        €
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Documents */}
              <DocumentsSection resolutionId={resolution.id} canManage={false} />

              {/* Feedback vote enregistré */}
              {isJustVoted && (
                <div className="px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
                  <Check size={16} className="text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">
                    Vote enregistré !
                  </span>
                </div>
              )}

              {/* Boutons de vote */}
              <div className="p-4 space-y-3">
                {voted && !isJustVoted && (
                  <p className="text-xs text-zinc-500 text-center mb-2">
                    Vous avez voté · Vous pouvez modifier votre choix
                  </p>
                )}
                {voteButtons.map((btn) => {
                  const isSelected = voted?.choix === btn.choix;
                  const Icon = btn.icon;
                  return (
                    <button
                      key={btn.choix}
                      onClick={() => handleVote(resolution.id, btn.choix)}
                      disabled={voting === resolution.id}
                      className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base text-white border transition-all active:scale-95 disabled:opacity-70 ${
                        isSelected ? btn.activeColor : btn.color
                      }`}
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

        {/* Votes terminés */}
        {votes.filter((v) => !resolutions.find((r) => r.id === v.resolution_id)).length >
          0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Mes votes enregistrés
            </h3>
            {votes.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                  Résolution #{v.resolution_id.slice(0, 8)}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    v.choix === "pour"
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : v.choix === "contre"
                      ? "bg-red-500/20 text-red-600 dark:text-red-400"
                      : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {v.choix.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
