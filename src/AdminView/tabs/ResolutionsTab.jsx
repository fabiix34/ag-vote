import { useState, useEffect } from "react";
import { Plus, BookOpen, ChevronDown, ChevronUp, X, Loader2, Save, CheckCircle } from "lucide-react";
import { resolutionService, templateService } from "../../services/db";
import { ResolutionCard } from "../../ResolutionCard/ResolutionCard";
import { PlaceholderEditor } from "../../ResolutionTemplates/PlaceholderEditor";
import { applyValues, saveAsTemplate } from "../../ResolutionTemplates/templates";
import { DocumentsSection } from "../../DocumentSection/DocumentSection";
import { MAJORITY_RULE_OPTIONS } from "../../utils/voteMajorityCalculator";

export function ResolutionsTab({ resolutions, votes, coproprietaires, pouvoirs, agSessionId, canModifyAgenda, canEditResolution, canLaunchVote, showAnticipeResults, isReadOnly, onUpdate }) {
  // --- États pour la Database (Modèles) ---
  const [dbModeles, setDbModeles] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // --- États du Formulaire ---
  const [newTitre, setNewTitre] = useState("");
  const [rawDesc, setRawDesc] = useState("");
  const [placeholderValues, setPlaceholderValues] = useState({});
  const [newMontant, setNewMontant] = useState("");
  const [newMajorityRule, setNewMajorityRule] = useState("ARTICLE_24");
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newResolutionId, setNewResolutionId] = useState(null);

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

  const resetForm = () => {
    setNewTitre("");
    setRawDesc("");
    setPlaceholderValues({});
    setNewMontant("");
    setNewMajorityRule("ARTICLE_24");
    setShowTemplates(false);
    setNewResolutionId(null);
  };

  // 2. Sélection d'un modèle
  const handleSelectTemplate = (tpl) => {
    setNewTitre(tpl.titre);
    setRawDesc(tpl.description);
    setPlaceholderValues({});
    setNewMontant(""); // On laisse l'utilisateur remplir si besoin
    setShowTemplates(false);
  };

  // 3. Sauvegarde de la résolution dans l'AG
  const handleAddResolution = async () => {
    if (!newTitre.trim()) return;
    setIsSaving(true);

    try {
      // Fusion des placeholders dans le texte final
      const finalDesc = applyValues(rawDesc, placeholderValues);

      // Nettoyage du montant
      const montantVal = newMontant.trim()
        ? parseFloat(newMontant.replace(/\s/g, "").replace(",", "."))
        : -1;

      const { data, error } = await resolutionService.create(agSessionId, {
        titre: newTitre.trim(),
        description: finalDesc.trim(),
        montant: isNaN(montantVal) ? -1 : montantVal,
        ordre: resolutions.length + 1,
        majority_rule: newMajorityRule,
      });

      if (error) throw error;

      setNewResolutionId(data.id);
      onUpdate();
    } catch (err) {
      console.error("Erreur ajout résolution:", err);
      alert("Erreur lors de l'ajout.");
    } finally {
      setIsSaving(false);
    }
  };

  // 4. Supprimer une résolution
  const handleDeleteResolution = async (id) => {
    if (!confirm("Supprimer cette résolution ?")) return;
    await resolutionService.delete(id);
    onUpdate();
  };

  const handleSaveAsTemplate = async () => {
    // Sécurité : on ne sauvegarde pas un modèle vide
    if (!newTitre.trim() || !rawDesc.trim()) {
      alert("Le titre et la description sont requis pour créer un modèle.");
      return;
    }

    // Demander la catégorie à l'utilisateur
    const category = prompt(
      "Sous quelle catégorie souhaitez-vous enregistrer ce modèle ? (ex: Travaux, Comptabilité, Divers)",
      "Divers"
    );

    if (!category) return; // Annule si l'utilisateur clique sur "Annuler"

    setIsSaving(true); // Utilise ton état de chargement existant
    try {
      await saveAsTemplate(newTitre.trim(), rawDesc.trim(), category.trim());

      // Rafraîchir la liste locale des modèles pour qu'il apparaisse dans le menu immédiatement
      const { data } = await templateService.fetchAll();
      setDbModeles(data);
      alert("Modèle ajouté à la bibliothèque avec succès !");
    } catch (error) {
      console.error("Erreur saveAsTemplate:", error);
      alert("Erreur lors de l'enregistrement du modèle.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
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
          <div className="relative max-w-[200px]">
            <input
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 pr-8 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500 font-mono"
              placeholder="Montant total €"
              value={newMontant}
              onChange={e => setNewMontant(e.target.value)}
              inputMode="decimal"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-bold">€</span>
          </div>

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

        {/* Section documents après enregistrement */}
        {newResolutionId && (
          <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 bg-zinc-50/50 dark:bg-zinc-800/30">
            <DocumentsSection resolutionId={newResolutionId} canManage={true} />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          {!newResolutionId ? (
            <>
              <button
                onClick={handleAddResolution}
                disabled={isSaving || !newTitre.trim()}
                className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 text-white px-5 py-2 rounded-lg font-semibold transition-all shadow-sm shadow-emerald-200 dark:shadow-none"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer la résolution
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

              {(newTitre || rawDesc) && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-zinc-500 hover:text-red-500 transition-colors font-medium"
                >
                  Annuler
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-semibold transition-all"
            >
              <CheckCircle size={14} /> Terminer
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