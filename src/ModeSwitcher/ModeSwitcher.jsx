// ============================================================
// COMPOSANT : Bouton bascule de mode (flottant)
// ============================================================
import { Shield, Users } from "lucide-react";


export function ModeSwitcher({ mode, onSwitch }) {
  return (
    <button
      onClick={onSwitch}
      title={mode === "admin" ? "Passer en mode Copropriétaire" : "Accès Syndic"}
      className={`
        fixed bottom-5 right-5 z-50
        flex items-center gap-2
        px-3 py-2 rounded-full text-xs font-medium
        border shadow-lg backdrop-blur-sm
        transition-all duration-200 active:scale-95
        ${mode === "admin"
          ? "bg-white/90 dark:bg-zinc-800/90 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          : "bg-white/90 dark:bg-zinc-900/90 border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-emerald-500 dark:hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400"
        }
      `}
    >
      {mode === "admin" ? (
        <><Users size={13} /> Mode copropriétaire</>
      ) : (
        <><Shield size={13} /> Accès syndic</>
      )}
    </button>
  );
}
