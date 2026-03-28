
import { useState } from "react";
import { CheckCircle, Edit3, Play, Trash2 } from "lucide-react";
import { supabase } from "../App";
import { StatutBadge } from "../StatutBadge/StatutBadge";
import { ResultatsResolution } from "../ResultatsResolution/ResultatsResolution";

export function ResolutionCard({ resolution, votes, coproprietaires, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [titre, setTitre] = useState(resolution.titre);
  const [description, setDescription] = useState(resolution.description || "");
  const [loading, setLoading] = useState(false);

  const handleStatutChange = async (statut) => {
    setLoading(true);
    // Si on lance un vote, mettre les autres en attente
    if (statut === "en_cours") {
      await supabase.from("resolutions")
        .update({ statut: "en_attente" })
        .eq("statut", "en_cours");
    }
    await supabase.from("resolutions").update({ statut }).eq("id", resolution.id);
    setLoading(false);
    onUpdate();
  };

  const handleSave = async () => {
    await supabase.from("resolutions").update({ titre, description }).eq("id", resolution.id);
    setEditing(false);
    onUpdate();
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${
      resolution.statut === "en_cours"
        ? "border-emerald-500 bg-emerald-500/5"
        : "bg-[var(--bg)] border-zinc-200 dark:border-zinc-800"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
              <textarea
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-emerald-500 resize-none"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <button onClick={handleSave} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg">Sauvegarder</button>
                <button onClick={() => setEditing(false)} className="text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 px-3 py-1 rounded-lg">Annuler</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-zinc-900 dark:text-white text-sm leading-tight">{resolution.titre}</h3>
              {resolution.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{resolution.description}</p>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatutBadge statut={resolution.statut} />
          {resolution.statut === "en_attente" && (
            <button onClick={() => setEditing(!editing)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Edit3 size={14} />
            </button>
          )}
          {resolution.statut === "en_attente" && (
            <button onClick={() => onDelete(resolution.id)} className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Résultats si votes */}
      {(resolution.statut === "en_cours" || resolution.statut === "termine") && (
        <ResultatsResolution resolution={resolution} votes={votes} coproprietaires={coproprietaires} />
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2 pt-1">
          {resolution.statut === "en_attente" && (
            <button
              onClick={() => handleStatutChange("en_cours")}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Play size={12} /> Lancer le vote
            </button>
          )}
          {resolution.statut === "en_cours" && (
            <button
              onClick={() => handleStatutChange("termine")}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={12} /> Clôturer
            </button>
          )}
          {resolution.statut === "termine" && (
            <span className="text-xs text-zinc-500 italic">Vote clôturé</span>
          )}
        </div>
      )}
    </div>
  );
}