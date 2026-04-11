// ============================================================
// COMPOSANT : Dashboard Syndic — liste des copropriétés
// ============================================================

import { useState, useEffect } from "react";
import { Shield, Plus, Building2, ArrowRight, LogOut, Users, Settings } from "lucide-react";
import { coproprieteService } from "../lib/services/copropriete.service";
import { ParametresModeles } from "./ParametresModeles";

// ─── Onglet : Mes copropriétés ───────────────────────────────────────────────

function TabCoproprietes({ syndic, onSelectCopropriete }) {
  const [coproprietes, setCoproprietes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newAdresse, setNewAdresse] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    coproprieteService.fetchBySyndic(syndic.id).then(({ data }) => {
      setCoproprietes(data || []);
      setLoading(false);
    });
  }, [syndic.id]);

  const handleCreate = async () => {
    if (!newNom.trim()) return;
    setCreating(true);
    const { data, error } = await coproprieteService.create({ syndicId: syndic.id, nom: newNom.trim(), adresse: newAdresse.trim() });
    if (!error && data) {
      setCoproprietes((prev) => [{ ...data, coproprietaires: [{ count: 0 }] }, ...prev]);
      setNewNom("");
      setNewAdresse("");
      setShowCreate(false);
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Mes copropriétés</h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            {coproprietes.length} copropriété{coproprietes.length > 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nouvelle copropriété
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
            Créer une nouvelle copropriété
          </h3>
          <div className="space-y-3">
            <input
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Nom de la copropriété *"
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <input
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Adresse (optionnel)"
              value={newAdresse}
              onChange={(e) => setNewAdresse(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating || !newNom.trim()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Créer
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewNom(""); setNewAdresse(""); }}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : coproprietes.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <Building2 size={40} className="text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 font-medium">Aucune copropriété</p>
          <p className="text-zinc-400 text-sm mt-1">Créez votre première copropriété pour commencer</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {coproprietes.map((cp) => {
            const nbCopros = cp.coproprietaires?.[0]?.count ?? 0;
            return (
              <button
                key={cp.id}
                onClick={() => onSelectCopropriete(cp)}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-xl p-5 text-left transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">{cp.nom}</h3>
                    {cp.adresse && <p className="text-zinc-500 text-sm">{cp.adresse}</p>}
                    <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                      <Users size={10} />
                      {nbCopros} copropriétaire{nbCopros > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-zinc-400 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function SyndicDashboard({ syndic, onSelectCopropriete, onLogout }) {
  const [activeTab, setActiveTab] = useState("coproprietes");

  const tabs = [
    { id: "coproprietes", label: "Mes copropriétés", icon: Building2 },
    { id: "parametres", label: "Paramètres", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-[var(--bg)] border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-900 dark:text-white text-sm">AG-Copro</h1>
            <p className="text-xs text-zinc-500">
              {syndic.prenom} {syndic.nom}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </header>

      {/* Onglets */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-6">
        <nav className="flex gap-1 max-w-4xl mx-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-4xl mx-auto p-6">
        {activeTab === "coproprietes" && (
          <TabCoproprietes syndic={syndic} onSelectCopropriete={onSelectCopropriete} />
        )}
        {activeTab === "parametres" && (
          <ParametresModeles />
        )}
      </main>
    </div>
  );
}
