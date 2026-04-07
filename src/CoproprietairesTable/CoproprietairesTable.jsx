import { useState } from "react";
import { UserPlus, Trash2, X } from "lucide-react";
import { coproprietaireService } from "../services/db";
import { formatTantiemes } from "../hooks/formatTantieme";

const PAGE_SIZES = [10, 25, 50];
const EMPTY_FORM = { nom: "", prenom: "", date_naissance: "", email: "", tantiemes: "" };

/**
 * Tableau des copropriétaires avec recherche, pagination et modal ajout/édition.
 *
 * Props :
 *  - coproprietaires  : tableau de copropriétaires
 *  - coproprieteId    : id de la copropriété (requis pour l'ajout)
 *  - showPresence     : affiche la colonne Présent/Absent (mode AG)
 *  - canEdit          : autorise le clic sur une ligne pour modifier
 *  - canDelete        : affiche le bouton supprimer
 *  - canAdd           : affiche le bouton Ajouter
 *  - title            : titre affiché dans le header (défaut : "Liste des copropriétaires")
 *  - subtitle         : sous-titre optionnel affiché à droite du titre
 *  - onMutate         : callback appelé après tout ajout / modification / suppression
 */
export function CoproprietairesTable({
  coproprietaires,
  coproprieteId,
  showPresence = false,
  canEdit = false,
  canDelete = false,
  canAdd = false,
  title = "Liste des copropriétaires",
  subtitle,
  onMutate,
}) {
  // --- Recherche & pagination ---
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // --- Modal ajout / édition ---
  const [showModal, setShowModal] = useState(false);
  const [editingCopro, setEditingCopro] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState(null);

  // --- Suppression ---
  const [deletingId, setDeletingId] = useState(null);

  // ---- Filtrage & pagination ----
  const q = search.trim().toLowerCase();
  const filtered = q
    ? coproprietaires.filter((c) =>
        `${c.prenom} ${c.nom}`.toLowerCase().includes(q) ||
        `${c.nom} ${c.prenom}`.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      )
    : coproprietaires;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // ---- Handlers modal ----
  const handleOpenAdd = () => {
    setEditingCopro(null);
    setForm(EMPTY_FORM);
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (c) => {
    if (!canEdit) return;
    setEditingCopro(c);
    setForm({
      nom: c.nom || "",
      prenom: c.prenom || "",
      email: c.email || "",
      date_naissance: c.date_naissance || "",
      tantiemes: c.tantiemes != null ? String(c.tantiemes) : "",
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditingCopro(null);
    setModalError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim()) {
      setModalError("Le nom et le prénom sont obligatoires.");
      return;
    }
    setSaving(true);
    setModalError(null);

    const payload = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      email: form.email.trim() || null,
      date_naissance: form.date_naissance.trim() || null,
      tantiemes: form.tantiemes ? Number(form.tantiemes) : 0,
    };

    const { error: err } = editingCopro
      ? await coproprietaireService.update(editingCopro.id, payload)
      : await coproprietaireService.create(coproprieteId, payload);

    setSaving(false);
    if (err) {
      setModalError(err.message);
    } else {
      handleClose();
      onMutate?.();
    }
  };

  const handleDelete = async (e, c) => {
    e.stopPropagation();
    if (!confirm(`Supprimer ${c.prenom} ${c.nom} ? Cette action est irréversible.`)) return;
    setDeletingId(c.id);
    await coproprietaireService.delete(c.id);
    setDeletingId(null);
    onMutate?.();
  };

  // ---- Colonnes ----
  const headers = ["Nom", "Prénom", "Email", "Tantièmes", ...(showPresence ? ["Présence"] : []), ...(canDelete ? [""] : [])];
  const colSpan = headers.length;

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3">
          <h3 className="font-medium text-zinc-900 dark:text-white text-sm flex-1 min-w-0">
            {title}
            {subtitle && <span className="ml-2 text-xs text-zinc-500 font-normal">{subtitle}</span>}
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
          {canAdd && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus size={13} />
              Ajouter
            </button>
          )}
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-zinc-500 dark:text-zinc-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-zinc-400 text-sm">
                    {q ? "Aucun résultat pour cette recherche." : "Aucun copropriétaire."}
                  </td>
                </tr>
              ) : slice.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => handleOpenEdit(c)}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${canEdit ? "cursor-pointer" : ""}`}
                >
                  <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">{c.nom}</td>
                  <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{c.prenom}</td>
                  <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{c.email || "—"}</td>
                  <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-mono">{formatTantiemes(c.tantiemes)}</td>
                  {showPresence && (
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.presence ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.presence ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500"}`} />
                        {c.presence ? "Présent" : "Absent"}
                      </span>
                    </td>
                  )}
                  {canDelete && (
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => handleDelete(e, c)}
                        disabled={deletingId === c.id}
                        className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
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

      {/* Modal ajout / édition */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={handleClose}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                {editingCopro ? "Modifier le copropriétaire" : "Ajouter un copropriétaire"}
              </h3>
              <button onClick={handleClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Dupont"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.prenom}
                    onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Jean"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="jean.dupont@exemple.fr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Date de naissance
                  </label>
                  <input
                    type="text"
                    value={form.date_naissance}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                      let formatted = raw;
                      if (raw.length > 4) formatted = raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4);
                      else if (raw.length > 2) formatted = raw.slice(0, 2) + "/" + raw.slice(2);
                      setForm((f) => ({ ...f, date_naissance: formatted }));
                    }}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="JJ/MM/AAAA"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tantièmes</label>
                  <input
                    type="number"
                    min="0"
                    value={form.tantiemes}
                    onChange={(e) => setForm((f) => ({ ...f, tantiemes: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {modalError && <p className="text-xs text-red-500">{modalError}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-sm px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : editingCopro ? "Sauvegarder" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
