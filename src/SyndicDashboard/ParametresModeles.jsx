// ============================================================
// COMPOSANT : Paramètres — Modèles de résolutions
// ============================================================

import { useState, useEffect, useRef } from "react";
import { Plus, FileText, Trash2, Tag, ChevronDown, ChevronUp, X, Save } from "lucide-react";
import { templateService } from "../lib/services/template.service";

// ─── Combobox catégorie ───────────────────────────────────────────────────────

function CategoryCombobox({ value, onChange, categories }) {
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Sync si la valeur externe change (ouverture modale en edit)
  useEffect(() => { setInputValue(value); }, [value]);

  // Fermer au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = categories.filter((c) =>
    c.toLowerCase().includes(inputValue.toLowerCase())
  );
  const exactMatch = categories.some(
    (c) => c.toLowerCase() === inputValue.trim().toLowerCase()
  );
  const showCreate = inputValue.trim() && !exactMatch;

  const select = (cat) => {
    setInputValue(cat);
    onChange(cat);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
        placeholder="Catégorie"
        value={inputValue}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && (filtered.length > 0 || showCreate) && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden text-sm">
          {filtered.map((c) => (
            <li key={c}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(c); }}
                className={`w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
                  c === value ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-zinc-900 dark:text-white"
                }`}
              >
                {c}
              </button>
            </li>
          ))}
          {showCreate && (
            <li className="border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(inputValue.trim()); }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
              >
                <Plus size={13} />
                Créer «&nbsp;{inputValue.trim()}&nbsp;»
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ─── Modale Edition / Création ───────────────────────────────────────────────

function TemplateModal({ template, categories, onClose, onSave }) {
  const [titre, setTitre] = useState(template?.titre ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [categorie, setCategorie] = useState(template?.categorie ?? categories[0] ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = !!template;
  const titreRef = useRef(null);

  useEffect(() => { titreRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!titre.trim() || !description.trim() || !categorie.trim()) return;
    setSaving(true);
    await onSave({ titre: titre.trim(), description: description.trim(), categorie: categorie.trim() });
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-white text-sm">
            {isEdit ? "Modifier le modèle" : "Nouveau modèle"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Titre *</label>
            <input
              ref={titreRef}
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="Titre de la résolution"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Texte *{" "}
              <span className="text-zinc-400 font-normal">— utilisez {"{{variable}}"} pour les champs dynamiques</span>
            </label>
            <textarea
              className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              placeholder="L'assemblée générale décide de…"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Catégorie *</label>
            <CategoryCombobox
              value={categorie}
              onChange={setCategorie}
              categories={categories}
            />
          </div>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-4 py-2 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !titre.trim() || !description.trim() || !categorie.trim()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ParametresModeles() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [modal, setModal] = useState(null); // null | { mode: "create" } | { mode: "edit", template }
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    templateService.fetchAll().then(({ data }) => {
      setTemplates(data || []);
      setLoading(false);
    });
  }, []);

  // Catégories distinctes dérivées des templates chargés
  const categories = [...new Set(templates.map((t) => t.categorie).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  const grouped = templates.reduce((acc, t) => {
    const cat = t.categorie || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const toggleCategory = (cat) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const handleSave = async ({ titre, description, categorie }) => {
    if (modal?.mode === "edit") {
      const { data, error } = await templateService.update(modal.template.id, { titre, description, categorie });
      if (!error && data) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === data.id ? data : t))
            .sort((a, b) => a.categorie.localeCompare(b.categorie))
        );
      }
    } else {
      const { data, error } = await templateService.create({ titre, description, categorie });
      if (!error && data) {
        setTemplates((prev) =>
          [...prev, data].sort((a, b) => a.categorie.localeCompare(b.categorie))
        );
      }
    }
    setModal(null);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setDeletingId(id);
    const { error } = await templateService.delete(id);
    if (!error) setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FileText size={20} className="text-emerald-600" />
            Modèles de résolutions
          </h2>
          <p className="text-zinc-500 text-sm mt-0.5">
            Modèles réutilisables lors de la création de résolutions en AG
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nouveau modèle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => {
            const isOpen = expandedCategories[cat] !== false;
            return (
              <div key={cat} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Tag size={14} className="text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold text-sm text-zinc-900 dark:text-white">{cat}</span>
                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={16} className="text-zinc-400" />
                  ) : (
                    <ChevronDown size={16} className="text-zinc-400" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {items.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setModal({ mode: "edit", template: t })}
                        className="w-full px-5 py-4 flex items-start justify-between gap-4 group text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-zinc-900 dark:text-white">{t.titre}</p>
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{t.description}</p>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, t.id)}
                          disabled={deletingId === t.id}
                          className="flex-shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer ce modèle"
                        >
                          {deletingId === t.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <TemplateModal
          template={modal.mode === "edit" ? modal.template : null}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
