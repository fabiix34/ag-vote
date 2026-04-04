import { useState, useEffect } from "react";
import { CheckCircle, XCircle, MinusCircle, LogOut, Vote, Check, Share2, Copy, UserCheck, X } from "lucide-react";
import { supabase } from "../App";
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

  // Acceptation d'un pouvoir reçu via lien
  const [pendingToken, setPendingToken] = useState(null);
  const [acceptingPouvoir, setAcceptingPouvoir] = useState(false);

  useEffect(() => {
    if (!agSession?.id) return;
    Promise.all([
      supabase.from("resolutions").select("*").eq("ag_session_id", agSession.id).order("ordre"),
      supabase.from("votes").select("*").eq("coproprietaire_id", profile.id),
      supabase.from("coproprietaires").select("tantiemes").eq("copropriete_id", profile.copropriete_id),
      supabase.from("pouvoirs")
        .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes)")
        .eq("ag_session_id", agSession.id)
        .eq("mandataire_id", profile.id),
      supabase.from("pouvoirs")
        .select("*, mandataire:coproprietaires!mandataire_id(id,nom,prenom)")
        .eq("ag_session_id", agSession.id)
        .eq("mandant_id", profile.id)
        .maybeSingle(),
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
    supabase
      .from("pouvoir_tokens")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom)")
      .eq("token", token)
      .eq("ag_session_id", agSession.id)
      .eq("used", false)
      .single()
      .then(({ data }) => {
        if (data && data.mandant_id !== profile.id) {
          setPendingToken(data);
        } else {
          sessionStorage.removeItem("pending_pouvoir_token");
        }
      });
  }, [agSession?.id, profile.id]);

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
      supabase.from("votes").upsert(
        { coproprietaire_id: profile.id, resolution_id: resolutionId, choix, tantiemes_poids: profile.tantiemes },
        { onConflict: "coproprietaire_id,resolution_id" }
      ).select().single(),
      ...pouvoirs.flatMap((pouvoir) => {
        const mandant = pouvoir.mandant;
        if (!mandant) return [];
        const choixMandant = pouvoir.votes_imposes?.[resolutionId] || choix;
        return [supabase.from("votes").upsert(
          { coproprietaire_id: mandant.id, resolution_id: resolutionId, choix: choixMandant, tantiemes_poids: mandant.tantiemes },
          { onConflict: "coproprietaire_id,resolution_id" }
        )];
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
    let { data: existing } = await supabase
      .from("pouvoir_tokens")
      .select("token")
      .eq("mandant_id", profile.id)
      .eq("ag_session_id", agSession.id)
      .single();

    if (!existing) {
      const { data: inserted } = await supabase
        .from("pouvoir_tokens")
        .insert({ mandant_id: profile.id, ag_session_id: agSession.id })
        .select("token")
        .single();
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
    const { error } = await supabase.from("pouvoirs").insert({
      mandant_id: pendingToken.mandant_id,
      mandataire_id: profile.id,
      ag_session_id: agSession.id,
    });
    if (!error) {
      await supabase.from("pouvoir_tokens").update({ used: true }).eq("id", pendingToken.id);
      sessionStorage.removeItem("pending_pouvoir_token");
      setPendingToken(null);
      // Rafraîchit les pouvoirs
      const { data: pvrs } = await supabase
        .from("pouvoirs")
        .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes)")
        .eq("ag_session_id", agSession.id)
        .eq("mandataire_id", profile.id);
      setPouvoirs(pvrs || []);
    }
    setAcceptingPouvoir(false);
  };

  const handleDeclinePouvoir = () => {
    sessionStorage.removeItem("pending_pouvoir_token");
    setPendingToken(null);
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

        {/* Bannière pouvoir donné */}
        {pouvoirDonne && (
          <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
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
        )}

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
