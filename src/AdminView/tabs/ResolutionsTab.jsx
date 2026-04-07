import { useState, useEffect, useRef } from "react";
import { Plus, BookOpen, ChevronDown, ChevronUp, X, Loader2, Paperclip, FileText } from "lucide-react";
import { resolutionService, templateService, documentService } from "../../services/db";
import { supabase } from "../../lib/supabase";
import { ResolutionCard } from "../../ResolutionCard/ResolutionCard";
import { PlaceholderEditor } from "../../ResolutionTemplates/PlaceholderEditor";
import { applyValues, saveAsTemplate } from "../../ResolutionTemplates/templates";
import { MAJORITY_RULE_OPTIONS } from "../../utils/voteMajorityCalculator";
import { AlertModal } from "../../components/AlertModal";

export function ResolutionsTab({ resolutions, votes, coproprietaires, pouvoirs, agSessionId, canModifyAgenda, canEditResolution, canLaunchVote, showAnticipeResults, isReadOnly, onUpdate }) {
  // --- État modal d'alerte ---
  const [alertModal, setAlertModal] = useState(null);
  const closeModal = () => setAlertModal(null);

  // --- États pour la Database (Modèles) ---
  const [dbModeles, setDbModeles] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // --- États du Formulaire ---
  const [newTitre, setNewTitre] = useState("");
  const [rawDesc, setRawDesc] = useState("");
  const [placeholderValues, setPlaceholderValues] = useState({});
  const [newMajorityRule, setNewMajorityRule] = useState("ARTICLE_24");
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileRef = useRef();

  // 1. Charger les modèles depuis Supabase au montage
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoadingTemplates(true);
    const { data, error } = await templateService.fetchAll();
    if (!error && data) {
      setDbModeles(data);
      const cats = [...new Set(data.map(m => m.categorie))];
      setDbCategories(cats);
    }
    setIsLoadingTemplates(false);
  };

  const sanitizeFilename = (name) =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");

  const resetForm = () => {
    setNewTitre("");
    setRawDesc("");
    setPlaceholderValues({});
    setNewMajorityRule("ARTICLE_24");
    setShowTemplates(false);
    setPendingFiles([]);
  };

  // 2. Sélection d'un modèle
  const handleSelectTemplate = (tpl) => {
    setNewTitre(tpl.titre);
    setRawDesc(tpl.description);
    setPlaceholderValues({});
    setNewMontant(""); // On laisse l'utilisateur remplir si besoin
    setShowTemplates(false);
  };

  // 3. Sauvegarde de la résolution + upload des fichiers en attente
  const handleAddResolution = async () => {
    if (!newTitre.trim()) return;
    setIsSaving(true);

    try {
      const finalDesc = applyValues(rawDesc, placeholderValues);

      const { data, error } = await resolutionService.create(agSessionId, {
        titre: newTitre.trim(),
        description: finalDesc.trim(),
        ordre: resolutions.length + 1,
        majority_rule: newMajorityRule,
      });

      if (error) throw error;

      // Upload des fichiers stagés
      if (pendingFiles.length > 0) {
        await Promise.all(
          pendingFiles.map(async (file) => {
            const path = `${data.id}/${Date.now()}-${sanitizeFilename(file.name)}`;
            const { error: storageError } = await supabase.storage
              .from("resolution-docs")
              .upload(path, file);
            if (!storageError) {
              await documentService.create(data.id, file.name, path);
            }
          })
        );
      }

      resetForm();
    } catch (err) {
      console.error("Erreur ajout résolution:", err);
      setAlertModal({
        title: "Erreur",
        message: "Une erreur est survenue lors de l'ajout de la résolution.",
        type: "error",
        buttons: [{ label: "OK", variant: "primary", onClick: closeModal }],
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Supprimer une résolution
  const handleDeleteResolution = (id) => {
    setAlertModal({
      title: "Supprimer cette résolution ?",
      type: "confirm",
      buttons: [
        { label: "Annuler", variant: "secondary", onClick: closeModal },
        { label: "Supprimer", variant: "danger", onClick: async () => {
          closeModal();
          await resolutionService.delete(id);
          onUpdate();
        }},
      ],
    });
  };

  const handleSaveAsTemplate = () => {
    if (!newTitre.trim() || !rawDesc.trim()) {
      setAlertModal({
        title: "Champs requis",
        message: "Le titre et la description sont requis pour créer un modèle.",
        type: "warning",
        buttons: [{ label: "OK", variant: "primary", onClick: closeModal }],
      });
      return;
    }

    setAlertModal({
      title: "Sauvegarder comme modèle",
      message: "Sous quelle catégorie souhaitez-vous enregistrer ce modèle ?",
      type: "prompt",
      input: { placeholder: "ex: Travaux, Comptabilité, Divers", defaultValue: "Divers" },
      buttons: [
        { label: "Annuler", variant: "secondary", onClick: closeModal },
        { label: "Enregistrer", variant: "primary", onClick: (category) => {
          if (!category?.trim()) return;
          closeModal();
          doSaveTemplate(category.trim());
        }},
      ],
    });
  };

  const doSaveTemplate = async (category) => {
    setIsSaving(true);
    try {
      await saveAsTemplate(newTitre.trim(), rawDesc.trim(), category);
      const { data } = await templateService.fetchAll();
      setDbModeles(data);
      setAlertModal({
        title: "Modèle enregistré",
        message: "Le modèle a été ajouté à la bibliothèque avec succès.",
        type: "success",
        buttons: [{ label: "OK", variant: "primary", onClick: closeModal }],
      });
    } catch (error) {
      console.error("Erreur saveAsTemplate:", error);
      setAlertModal({
        title: "Erreur",
        message: "Une erreur est survenue lors de l'enregistrement du modèle.",
        type: "error",
        buttons: [{ label: "OK", variant: "primary", onClick: closeModal }],
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AlertModal
        isOpen={!!alertModal}
        onClose={closeModal}
        title={alertModal?.title ?? ""}
        message={alertModal?.message}
        type={alertModal?.type}
        buttons={alertModal?.buttons ?? []}
        input={alertModal?.input ?? null}
      />
      {/* --- FORMULAIRE D'AJOUT (masqué si AG terminée) --- */}
      {isReadOnly && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
          Cette AG est terminée — les résolutions ne peuvent plus être modifiées.
        </div>
      )}
      {!isReadOnly && !canModifyAgenda && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Le vote est ouvert — l'ordre du jour est verrouillé.
        </div>
      )}
      {canModifyAgenda && (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 shadow-sm">

        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
            <Plus size={16} className="text-emerald-500" />
            Nouvelle résolution
          </h3>

          {/* Bouton Modèles */}
          <button
            type="button"
            disabled={isLoadingTemplates}
            onClick={() => setShowTemplates(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium ${showTemplates
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
          >
            {isLoadingTemplates ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
            Bibliothèque de modèles
            {showTemplates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Menu déroulant des modèles */}
        {showTemplates && (
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-800/30 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
            {dbCategories.map((cat, ci) => (
              <div key={cat}>
                <div className={`px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100/50 dark:bg-zinc-800/50 ${ci > 0 ? 'border-t border-zinc-200 dark:border-zinc-700' : ''
                  }`}>
                  {cat}
                </div>
                {dbModeles.filter(m => m.categorie === cat).map(tpl => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className="w-full text-left px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border-t border-zinc-100 dark:border-zinc-800/50 first:border-0"
                  >
                    {tpl.titre}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Champ Titre */}
        <div className="relative">
          <input
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            placeholder="Titre de la résolution (ex: Approbation des comptes)..."
            value={newTitre}
            onChange={e => setNewTitre(e.target.value)}
          />
          {newTitre && (
            <button
              type="button"
              onClick={() => setNewTitre("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Éditeur intelligent (Placeholders) */}
        <PlaceholderEditor
          rawText={rawDesc}
          onRawTextChange={setRawDesc}
          values={placeholderValues}
          onValuesChange={setPlaceholderValues}
        />

        {/* Champs Montant + Règle de majorité */}
        <div className="flex flex-wrap gap-3 items-end">

          {/* Règle de majorité (loi du 10 juillet 1965) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Majorité requise</label>
            <select
              value={newMajorityRule}
              onChange={e => setNewMajorityRule(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all"
            >
              {MAJORITY_RULE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Section fichiers — staging avant création */}
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Paperclip size={11} /> Documents joints {pendingFiles.length > 0 && `(${pendingFiles.length})`}
            </p>
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus size={11} /> Ajouter
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) setPendingFiles((prev) => [...prev, file]);
                e.target.value = "";
              }}
            />
          </div>
          {pendingFiles.length === 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">Aucun document joint</p>
          )}
          {pendingFiles.length > 0 && (
            <div className="space-y-1">
              {pendingFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg px-2.5 py-1.5 text-xs">
                  <FileText size={11} className="text-zinc-400 shrink-0" />
                  <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-zinc-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleAddResolution}
            disabled={isSaving || !newTitre.trim()}
            className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white px-5 py-2 rounded-lg font-semibold transition-all shadow-sm shadow-emerald-200 dark:shadow-none"
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {isSaving ? "Enregistrement..." : "Ajouter la résolution"}
          </button>

          {(newTitre || rawDesc) && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAsTemplate}
              className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors font-medium border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
              Sauvegarder comme modèle
            </button>
          )}

          {(newTitre || rawDesc || pendingFiles.length > 0) && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-zinc-500 hover:text-red-500 transition-colors font-medium"
            >
              Annuler
            </button>
          )}
        </div>
      </div>
      )}

      {/* --- LISTE DES RÉSOLUTIONS --- */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-2 px-1">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Ordre du jour ({resolutions.length})
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800"></div>
        </div>

        {resolutions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <p className="text-zinc-400 text-sm">L'ordre du jour est vide.</p>
          </div>
        ) : (
          resolutions
            .sort((a, b) => a.ordre - b.ordre)
            .map((r) => (
              <ResolutionCard
                key={r.id}
                resolution={r}
                votes={votes}
                coproprietaires={coproprietaires}
                pouvoirs={pouvoirs || []}
                canModifyAgenda={canModifyAgenda}
                canEditResolution={canEditResolution}
                canLaunchVote={canLaunchVote}
                showAnticipeResults={showAnticipeResults}
                onUpdate={onUpdate}
                onDelete={handleDeleteResolution}
              />
            ))
        )}
      </div>
    </div>
  );
}