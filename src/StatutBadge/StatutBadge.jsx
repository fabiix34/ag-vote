
// ============================================================
// COMPOSANT : Badge statut
// ============================================================
export function StatutBadge({ statut }) {
  const config = {
    en_attente: { label: "En attente", cls: "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300" },
    en_cours: { label: "● Vote en cours", cls: "bg-emerald-500/20 text-emerald-400 animate-pulse" },
    termine: { label: "Terminé", cls: "bg-blue-500/20 text-blue-400" },
  };
  const { label, cls } = config[statut] || config.en_attente;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}
