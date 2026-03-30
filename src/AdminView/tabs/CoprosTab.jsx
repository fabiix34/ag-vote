import { useState } from "react";
import { UserPlus, Trash2, X } from "lucide-react";
import { formatTantiemes } from "../../hooks/formatTantieme";
import { supabase } from "../../App";

const EMPTY_FORM = { nom: "", prenom: "", date_naissance: "", email: "", tantiemes: "" };

export function CoprosTab({ coproprietaires, votes, coproprieteId, onSave, onDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom.trim() || !form.prenom.trim()) {
      setError("Le nom et le prénom sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("coproprietaires").insert({
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      email: form.email.trim() || null,
      date_naissance: form.date_naissance.trim() || null,
      tantiemes: form.tantiemes ? Number(form.tantiemes) : 0,
      copropriete_id: coproprieteId,
      presence: false,
    });
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      handleClose();
      onSave();
    }
  };

  const handleDelete = async (id, nom, prenom) => {
    if (!confirm(`Supprimer ${prenom} ${nom} ? Cette action est irréversible.`)) return;
    setDeletingId(id);
    await supabase.from("coproprietaires").delete().eq("id", id);
    setDeletingId(null);
    onDelete?.();
  };

  return (
    <>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-zinc-900 dark:text-white">
            Liste des copropriétaires ({coproprietaires.length})
          </h2>
          <button
            onClick={handleOpen}
            className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <UserPlus size={13} />
            Ajouter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 dark:bg-zinc-800">
              <tr>
                {["Nom", "Prénom", "Email", "Tantièmes", "Présence", "Votes", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-zinc-500 dark:text-zinc-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {coproprietaires.map((c) => {
                const nbVotes = votes.filter((v) => v.coproprietaire_id === c.id).length;
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-zinc-800 dark:text-zinc-200">{c.nom}</td>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">{c.prenom}</td>
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{c.email}</td>
                    <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-mono">{formatTantiemes(c.tantiemes)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${c.presence ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.presence ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-500"}`} />
                        {c.presence ? "Présent" : "Absent"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500 dark:text-zinc-400">{nbVotes}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDelete(c.id, c.nom, c.prenom)}
                        disabled={deletingId === c.id}
                        className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ajout */}
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
              <h3 className="font-semibold text-zinc-900 dark:text-white">Ajouter un copropriétaire</h3>
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
                    Date de naissance <span className="text-red-500">*</span>
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

              {error && <p className="text-xs text-red-500">{error}</p>}

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
                  {saving ? "Enregistrement..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
