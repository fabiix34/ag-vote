// ============================================================
// COMPOSANT : Dashboard Syndic — liste des copropriétés
// ============================================================

import { useState, useEffect } from "react";
import { Shield, Plus, Building2, ArrowRight, LogOut, Users, Settings, X } from "lucide-react";
import { coproprieteService } from "../lib/services/copropriete.service";
import { ParametresModeles } from "./ParametresModeles";

const PAGE_SIZES = [10, 25, 50];

// ─── Onglet : Mes copropriétés ───────────────────────────────────────────────

function TabCoproprietes({ syndic, onSelectCopropriete }) {
  const [coproprietes, setCoproprietes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Recherche & pagination
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Modal création
  const [showModal, setShowModal] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newAdresse, setNewAdresse] = useState("");
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState(null);

  useEffect(() => {
    coproprieteService.fetchBySyndic(syndic.id).then(({ data }) => {
      setCoproprietes(data || []);
      setLoading(false);
    });
  }, [syndic.id]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newNom.trim()) { setModalError("Le nom est obligatoire."); return; }
    setCreating(true);
    setModalError(null);
    const { data, error } = await coproprieteService.create({ syndicId: syndic.id, nom: newNom.trim(), adresse: newAdresse.trim() });
    setCreating(false);
    if (!error && data) {
      setCoproprietes((prev) => [{ ...data, coproprietaires: [{ count: 0 }] }, ...prev]);
      setNewNom("");
      setNewAdresse("");
      setShowModal(false);
    } else {
      setModalError(error?.message ?? "Erreur lors de la création.");
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewNom("");
    setNewAdresse("");
    setModalError(null);
  };

  // Filtrage & pagination
  const q = search.trim().toLowerCase();
  const filtered = q
    ? coproprietes.filter((cp) =>
        cp.nom.toLowerCase().includes(q) ||
        (cp.adresse || "").toLowerCase().includes(q)
      )
    : coproprietes;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3">
          <h3 className="font-medium text-zinc-900 dark:text-white text-sm flex-1 min-w-0">
            Mes copropriétés
            <span className="ml-2 text-xs text-zinc-500 font-normal">{coproprietes.length} au total</span>
          </h3>
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 w-44"
          />
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n} par page</option>
            ))}
          </select>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            Ajouter
          </button>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                {["Nom", "Adresse", "Copropriétaires", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-zinc-500 dark:text-zinc-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : slice.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 text-sm">
                    {q ? "Aucun résultat pour cette recherche." : "Aucune copropriété."}
                  </td>
                </tr>
              ) : slice.map((cp) => {
                const nbCopros = cp.coproprietaires?.[0]?.count ?? 0;
                return (
                  <tr
                    key={cp.id}
                    onClick={() => onSelectCopropriete(cp)}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        {cp.nom}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{cp.adresse || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <Users size={12} />
                        {nbCopros} copropriétaire{nbCopros > 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ArrowRight size={15} className="text-zinc-400 group-hover:text-emerald-500 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} sur {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .reduce((acc, n, i, arr) => {
                  if (i > 0 && n - arr[i - 1] > 1) acc.push("…");
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) =>
                  n === "…" ? (
                    <span key={`sep-${i}`} className="text-xs text-zinc-400 px-1">…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${n === safePage ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                    >
                      {n}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="text-xs px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal création */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Nouvelle copropriété</h3>
              <button onClick={handleCloseModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newNom}
                  onChange={(e) => setNewNom(e.target.value)}
                  autoFocus
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Résidence Les Pins"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Adresse</label>
                <input
                  type="text"
                  value={newAdresse}
                  onChange={(e) => setNewAdresse(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="12 rue des Acacias, 75001 Paris (facultatif)"
                />
              </div>
              {modalError && <p className="text-xs text-red-500">{modalError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-sm px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="text-sm px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {creating ? "Création…" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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
