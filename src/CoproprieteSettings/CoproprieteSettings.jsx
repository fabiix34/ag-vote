// ============================================================
// COMPOSANT : Paramétrage d'une Copropriété
// Tabs : Copropriétaires | Import | Assemblées Générales
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Users,
  Calendar,
  Plus,
  Play,
  Eye,
  CheckCircle2,
  Clock,
  Pencil,
  Check,
  X,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { coproprietaireService, agSessionService, coproprieteService } from "../services/db";
import { CoprosTab } from "../AdminView/tabs/CoprosTab";
import { AuditTab } from "./AuditTab";
import { AlertModal } from "../components/AlertModal";

const STATUS_INFO = {
  vote_anticipe: {
    label: "Vote anticipé actif",
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    Icon: Eye,
  },
  planifiee: {
    label: "Planifiée",
    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    Icon: Clock,
  },
  en_cours: {
    label: "En cours",
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    Icon: Play,
  },
  terminee: {
    label: "Terminée",
    color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800",
    Icon: CheckCircle2,
  },
};

export function CoproprieteSettings({ copropriete, onOpenAG, onBack }) {
  const [tab, setTab] = useState("ag");
  const [coproprietaires, setCoproprietaires] = useState([]);
  const [agSessions, setAgSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulaire nouvelle AG
  const [showNewAG, setShowNewAG] = useState(false);
  const [newAGDate, setNewAGDate] = useState(new Date().toISOString().split("T")[0]);
  const [creatingAG, setCreatingAG] = useState(false);

  // Confirm ordre du jour
  const [confirmODJ, setConfirmODJ] = useState(false);
  const [pendingAG, setPendingAG] = useState(null);

  // Édition nom copropriété
  const [editingNom, setEditingNom] = useState(false);
  const [nomValue, setNomValue] = useState(copropriete.nom);
  const [savingNom, setSavingNom] = useState(false);

  const fetchCoproprietaires = async () => {
    const { data, error } = await coproprietaireService.fetchByCopropriete(copropriete.id);
    if (!error) setCoproprietaires(data || []);
  };

  const fetchAll = useCallback(async () => {
    const [, { data: ags }] = await Promise.all([
      fetchCoproprietaires(),
      agSessionService.fetchByCopropriete(copropriete.id),
    ]);
    setAgSessions(ags || []);
    setLoading(false);
  }, [copropriete.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreateAG = async () => {
    setCreatingAG(true);
    const { data, error } = await agSessionService.create(copropriete.id, newAGDate);
    if (!error && data) {
      setAgSessions((prev) => [data, ...prev]);
      setShowNewAG(false);
      setPendingAG(data);
      setConfirmODJ(true);
    }
    setCreatingAG(false);
  };

  const handleSaveNom = async () => {
    if (!nomValue.trim() || nomValue === copropriete.nom) {
      setEditingNom(false);
      setNomValue(copropriete.nom);
      return;
    }
    setSavingNom(true);
    await coproprieteService.updateNom(copropriete.id, nomValue.trim());
    copropriete.nom = nomValue.trim();
    setEditingNom(false);
    setSavingNom(false);
  };

  const tabs = [
    { id: "ag", label: "Assemblées générales", icon: Calendar },
    { id: "membres", label: "Copropriétaires", icon: Users },
    { id: "audit", label: "Piste d'audit", icon: ShieldCheck },
  ];

  return (
    <>
    <AlertModal
      isOpen={confirmODJ}
      onClose={() => setConfirmODJ(false)}
      type="success"
      title="AG créée avec succès"
      message="Voulez-vous continuer vers la création de l'ordre du jour ?"
      buttons={[
        {
          label: "Non, rester ici",
          variant: "secondary",
          onClick: () => setConfirmODJ(false),
        },
        {
          label: "Oui, créer l'ordre du jour",
          variant: "primary",
          onClick: () => { setConfirmODJ(false); onOpenAG(pendingAG); },
        },
      ]}
    />
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-[var(--bg)] border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          {editingNom ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                className="flex-1 bg-white dark:bg-zinc-900 border border-emerald-400 rounded-lg px-3 py-1.5 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none"
                value={nomValue}
                onChange={(e) => setNomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveNom();
                  if (e.key === "Escape") { setEditingNom(false); setNomValue(copropriete.nom); }
                }}
                autoFocus
              />
              <button onClick={handleSaveNom} disabled={savingNom} className="text-emerald-500 hover:text-emerald-600">
                <Check size={16} />
              </button>
              <button onClick={() => { setEditingNom(false); setNomValue(copropriete.nom); }} className="text-zinc-400 hover:text-zinc-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="font-bold text-zinc-600 dark:text-white truncate leading-normal">{copropriete.nom}</h1>
              <button
                onClick={() => setEditingNom(true)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0"
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
        </div>
        {copropriete.adresse && (
          <p className="text-zinc-500 text-sm ml-7 mt-0.5">{copropriete.adresse}</p>
        )}
      </header>

      {/* Tabs */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800 px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id
                ? "border-emerald-500 text-emerald-500 dark:text-emerald-400"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Onglet Membres */}
            {tab === "membres" && (
              <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                  {coproprietaires.length} copropriétaire
                  {coproprietaires.length > 1 ? "s" : ""} enregistré
                  {coproprietaires.length > 1 ? "s" : ""}
                </p>
                <CoprosTab coproprietaires={coproprietaires} coproprieteId={copropriete.id} onSave={fetchCoproprietaires} onDelete={fetchCoproprietaires} />
              </div>
            )}

            {/* Onglet Audit */}
            {tab === "audit" && (
              <AuditTab agSessions={agSessions} coproprietaires={coproprietaires} />
            )}

            {/* Onglet AG */}
            {tab === "ag" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900 dark:text-white">
                    Assemblées générales
                  </h3>
                  <button
                    onClick={() => setShowNewAG(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Plus size={14} />
                    Planifier une AG
                  </button>
                </div>

                {/* Formulaire nouvelle AG */}
                {showNewAG && (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
                    <h4 className="font-medium text-zinc-900 dark:text-white text-sm">
                      Nouvelle assemblée générale
                    </h4>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                        Date de l'AG
                      </label>
                      <input
                        type="date"
                        className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                        value={newAGDate}
                        onChange={(e) => setNewAGDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleCreateAG}
                        disabled={creatingAG}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {creatingAG ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Créer l'AG
                      </button>
                      <button
                        onClick={() => setShowNewAG(false)}
                        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* Liste des AG */}
                {agSessions.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <Calendar size={36} className="text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500 font-medium">Aucune AG planifiée</p>
                    <p className="text-zinc-400 text-sm mt-1">
                      Créez une première AG pour commencer à gérer vos assemblées générales et leurs ordres du jour.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agSessions.map((ag) => {
                      const info = STATUS_INFO[ag.statut] || STATUS_INFO.planifiee;
                      const dateStr = ag.date_ag
                        ? new Date(ag.date_ag).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                        : "Date non définie";

                      return (
                        <div
                          key={ag.id}
                          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${info.color}`}
                            >
                              <info.Icon size={11} />
                              {info.label}
                            </span>
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              AG du {dateStr}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Créée le{" "}
                              {new Date(ag.created_at).toLocaleDateString("fr-FR")}
                            </p>
                          </div>

                          <div className="flex-shrink-0">
                            <button
                              onClick={() => onOpenAG(ag)}
                              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-4 py-2 rounded-lg text-sm transition-colors"
                            >
                              Accéder
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
    </>
  );
}
