
// ============================================================
// COMPOSANT : Loader
// ============================================================
export function Loader({ text = "Chargement..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-500 dark:text-zinc-400 text-sm">{text}</p>
    </div>
  );
}