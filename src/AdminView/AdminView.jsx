// ============================================================
// VUE AG — Gestion d'une Assemblée Générale
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  FileSignature,
  Vote,
  Shield,
  Wifi,
  WifiOff,
  QrCode,
  ArrowLeft,
  StopCircle,
  PlayCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRealtime } from "../hooks/useRealtime";
import { coproprietaireService, resolutionService, pouvoirService, voteService, agSessionService } from "../services/db";
import { AG_STATUT } from "../utils/agStatut";
import { DashboardTab } from "./tabs/DashboardTab";
import { CoprosTab } from "./tabs/CoprosTab";
import { ResolutionsTab } from "./tabs/ResolutionsTab";
import { PouvoirsTab } from "./tabs/PouvoirsTab";
import { PVGenerator } from "../PVGenerator/PVGenerator";
import { Loader } from "../Loader/Loader";
import { AlertModal } from "../components/AlertModal";

export function AdminView({ copropriete, agSession: initialAgSession, syndicId, onBack, onEndAG }) {
  const [agSession, setAgSession] = useState(initialAgSession);
  const [tab, setTab] = useState(initialAgSession.statut === AG_STATUT.PLANIFIEE ? "resolutions" : "dashboard");
  const [coproprietaires, setCoproprietaires] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [pouvoirs, setPouvoirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [connected, setConnected] = useState(true);
  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [togglingAnticipe, setTogglingAnticipe] = useState(false);
  const [alertModal, setAlertModal] = useState(null);
  const closeModal = () => setAlertModal(null);

  const statut = agSession.statut;
  const isConstruction = statut === AG_STATUT.PLANIFIEE;
  const isAnticipe     = statut === AG_STATUT.VOTE_ANTICIPE;
  const isLive         = statut === AG_STATUT.EN_COURS;
  const isTerminee     = statut === AG_STATUT.TERMINEE;

  const showDashboard = isLive || isTerminee;
  const showPouvoirs  = isAnticipe || isLive || isTerminee;

  const fetchAll = useCallback(async () => {
    const [{ data: copros }, { data: resols }, { data: pvrs }] = await Promise.all([
      coproprietaireService.fetchByCopropriete(copropriete.id),
      resolutionService.fetchByAgSession(agSession.id),
      pouvoirService.fetchByAgSession(agSession.id),
    ]);
    const resolutionIds = (resols || []).map((r) => r.id);
    const { data: vts } = resolutionIds.length
      ? await voteService.fetchByResolutions(resolutionIds)
      : { data: [] };
    setCoproprietaires(copros || []);
    setResolutions(resols || []);
    setVotes(vts || []);
    setPouvoirs(pvrs || []);
    setLoading(false);
  }, [copropriete.id, agSession.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscriptions — mises à jour ciblées sans refetch global

  useRealtime("votes", (payload) => {
    setVotes((prev) => {
      if (payload.eventType === "INSERT") return [...prev, payload.new];
      if (payload.eventType === "UPDATE")
        return prev.map((v) => (v.id === payload.new.id ? payload.new : v));
      if (payload.eventType === "DELETE")
        return prev.filter((v) => v.id !== payload.old.id);
      return prev;
    });
  }, { onStatusChange: setConnected });

  useRealtime("resolutions", (payload) => {
    if (payload.eventType !== "DELETE" && payload.new?.ag_session_id !== agSession.id) return;
    setResolutions((prev) => {
      if (payload.eventType === "INSERT")
        return prev.find((r) => r.id === payload.new.id)
          ? prev
          : [...prev, payload.new].sort((a, b) => a.ordre - b.ordre);
      if (payload.eventType === "UPDATE")
        return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
      if (payload.eventType === "DELETE")
        return prev.filter((r) => r.id !== payload.old.id);
      return prev;
    });
  });

  useRealtime("pouvoirs", (payload) => {
    if (payload.new?.ag_session_id !== agSession.id && payload.old?.ag_session_id !== agSession.id) return;
    setPouvoirs((prev) => {
      if (payload.eventType === "INSERT") return [...prev, payload.new];
      if (payload.eventType === "UPDATE")
        return prev.map((p) => (p.id === payload.new.id ? payload.new : p));
      if (payload.eventType === "DELETE")
        return prev.filter((p) => p.id !== payload.old.id);
      return prev;
    });
  });

  useRealtime("coproprietaires", (payload) => {
    if (payload.eventType === "UPDATE") {
      setCoproprietaires((prev) =>
        prev.map((c) => (c.id === payload.new.id ? payload.new : c))
      );
    } else {
      // INSERT / DELETE sont rares, un refetch complet suffit
      fetchAll();
    }
  });

  const handleToggleAnticipe = async () => {
    setTogglingAnticipe(true);
    const newStatut = isAnticipe ? AG_STATUT.PLANIFIEE : AG_STATUT.VOTE_ANTICIPE;
    if (isAnticipe) {
      await agSessionService.deactivateVoteAnticipe(agSession.id); // repasse à planifiee
    } else {
      await agSessionService.activateVoteAnticipe(agSession.id);
    }
    setAgSession((prev) => ({ ...prev, statut: newStatut }));
    setTogglingAnticipe(false);
  };

  const handleStartAG = async () => {
    setStarting(true);
    await agSessionService.updateStatut(agSession.id, AG_STATUT.EN_COURS);
    setAgSession((prev) => ({ ...prev, statut: AG_STATUT.EN_COURS }));
    setStarting(false);
  };

  const handleOpenSession = async () => {
    setStarting(true);
    await agSessionService.deactivateVoteAnticipe(agSession.id);
    setAgSession((prev) => ({ ...prev, statut: AG_STATUT.EN_COURS }));
    setStarting(false);
  };

  const handleEndAG = () => {
    setAlertModal({
      title: "Terminer l'AG ?",
      message: "Toutes les résolutions en cours seront clôturées.",
      type: "confirm",
      buttons: [
        { label: "Annuler", variant: "secondary", onClick: closeModal },
        { label: "Terminer l'AG", variant: "danger", onClick: async () => {
          closeModal();
          setEnding(true);
          await resolutionService.closeAllActive(agSession.id);
          await agSessionService.terminate(agSession.id);
          await coproprietaireService.resetAllPresence(copropriete.id);
          setEnding(false);
          onEndAG();
        }},
      ],
    });
  };

  // Redirige vers un onglet valide si la phase change
  useEffect(() => {
    if (!showDashboard && tab === "dashboard") setTab("resolutions");
    if (!showPouvoirs && tab === "pouvoirs") setTab("resolutions");
    if (showDashboard && isLive && tab === "resolutions") setTab("dashboard");
  }, [agSession.statut]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [
    ...(showDashboard ? [{ id: "dashboard", label: "Dashboard", icon: BarChart3 }] : []),
    { id: "resolutions", label: isConstruction ? "Ordre du jour" : "Résolutions", icon: Vote },
    ...(showPouvoirs ? [{ id: "pouvoirs", label: "Pouvoirs", icon: FileSignature, badge: pouvoirs.length || null }] : []),
  ];

  const dateStr = agSession.date_ag
    ? new Date(agSession.date_ag).toLocaleDateString("fr-FR")
    : "—";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-zinc-900 dark:text-white">
      <AlertModal
        isOpen={!!alertModal}
        onClose={closeModal}
        title={alertModal?.title ?? ""}
        message={alertModal?.message}
        type={alertModal?.type}
        buttons={alertModal?.buttons ?? []}
        input={alertModal?.input ?? null}
      />
      {/* Header */}
      <header className="bg-[var(--bg)] border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-zinc-900 dark:text-white text-sm truncate">
              {copropriete.nom}
            </h1>
            <p className="text-xs text-zinc-500">
              AG du {dateStr} ·{" "}
              <span
                className={isTerminee ? "text-zinc-400" : isAnticipe ? "text-blue-500" : "text-emerald-500"}
              >
                {isTerminee ? "Terminée" : isConstruction ? "Planifiée" : isAnticipe ? "Vote anticipé" : "En cours"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div
            className={`flex items-center gap-1.5 text-xs ${
              connected
                ? "text-emerald-500 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? "Temps réel" : "Déconnecté"}
          </div>

          {!loading && isTerminee && (
            <PVGenerator
              resolutions={resolutions}
              votes={votes}
              coproprietaires={coproprietaires}
            />
          )}

          {/* Phase construction : activer vote anticipé + démarrer l'AG */}
          {isConstruction && (
            <>
              <button
                onClick={handleToggleAnticipe}
                disabled={togglingAnticipe}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 border bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
              >
                <Vote size={14} />
                Activer vote anticipé
              </button>
              <button
                onClick={handleStartAG}
                disabled={starting}
                className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <PlayCircle size={14} />
                {starting ? "Démarrage..." : "Démarrer l'AG"}
              </button>
            </>
          )}

          {/* Phase vote anticipé : désactiver ou ouvrir la séance */}
          {isAnticipe && (
            <>
              <button
                onClick={handleToggleAnticipe}
                disabled={togglingAnticipe}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 border bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
              >
                <Vote size={14} />
                Vote anticipé actif
              </button>
              <button
                onClick={handleOpenSession}
                disabled={starting}
                className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <PlayCircle size={14} />
                {starting ? "Ouverture..." : "Ouvrir la séance"}
              </button>
            </>
          )}

          {/* Phase live : QR Code + terminer */}
          {isLive && (
            <>
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex items-center gap-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                <QrCode size={14} />
                QR Code
              </button>
              <button
                onClick={handleEndAG}
                disabled={ending}
                className="flex items-center gap-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <StopCircle size={14} />
                {ending ? "Clôture..." : "Terminer l'AG"}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Modal QR Code */}
      {showQR && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowQR(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-8 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-zinc-900 dark:text-white">
              QR Code Copropriétaires
            </h2>
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeSVG value={window.location.origin.replace("syndic", "copro")} size={200} />
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">
              {window.location.origin.replace("syndic", "copro")}
            </p>
            <p className="text-zinc-500 text-xs">
              Les copropriétaires scannent ce QR pour accéder à l'interface de vote
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="bg-[var(--bg)] border-b border-zinc-200 dark:border-zinc-800 px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-emerald-500 text-emerald-500 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <t.icon size={14} />
              {t.label}
              {t.badge ? (
                <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        {loading ? (
          <Loader />
        ) : (
          <>
            {tab === "dashboard" && (
              <DashboardTab
                coproprietaires={coproprietaires}
                resolutions={resolutions}
                votes={votes}
                agSession={agSession}
                pouvoirs={pouvoirs}
              />
            )}
            {tab === "copros" && (
              <CoprosTab coproprietaires={coproprietaires} votes={votes} coproprieteId={copropriete.id} isReadOnly={true} />
            )}
            {tab === "resolutions" && (
              <ResolutionsTab
                resolutions={resolutions}
                votes={votes}
                coproprietaires={coproprietaires}
                pouvoirs={pouvoirs}
                agSessionId={agSession.id}
                syndicId={syndicId}
                canModifyAgenda={isConstruction}
                canEditResolution={isConstruction}
                canLaunchVote={isLive}
                showAnticipeResults={isAnticipe}
                isReadOnly={isTerminee}
                onUpdate={fetchAll}
              />
            )}
            {tab === "pouvoirs" && (
              <PouvoirsTab
                pouvoirs={pouvoirs}
                coproprietaires={coproprietaires}
                resolutions={resolutions}
                agSessionId={agSession.id}
                isReadOnly={!isConstruction}
                onUpdate={fetchAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
