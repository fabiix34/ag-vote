import { useEffect, useRef } from "react";
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from "lucide-react";

const TYPE_CONFIG = {
  success: { Icon: CheckCircle, iconClass: "text-emerald-500" },
  error:   { Icon: AlertCircle,  iconClass: "text-red-500" },
  warning: { Icon: AlertTriangle, iconClass: "text-amber-500" },
  info:    { Icon: Info,          iconClass: "text-blue-500" },
  confirm: { Icon: AlertTriangle, iconClass: "text-amber-500" },
  prompt:  { Icon: Info,          iconClass: "text-blue-500" },
};

/**
 * AlertModal — popup générique remplaçant alert(), confirm() et prompt().
 *
 * Props :
 *   isOpen   {boolean}
 *   onClose  {() => void}          — appelé sur Échap ou clic backdrop
 *   title    {string}
 *   message  {string?}             — texte secondaire optionnel
 *   type     {'info'|'success'|'error'|'warning'|'confirm'|'prompt'}
 *   buttons  {Array<{ label, variant:'primary'|'danger'|'secondary', onClick: (value?) => void }>}
 *   input    {{ placeholder?, defaultValue? }}   — si présent, affiche un champ texte
 *                                                   la valeur courante est passée à onClick
 */
export function AlertModal({ isOpen, onClose, title, message, type = "info", buttons = [], input = null }) {
  const inputRef = useRef();

  // Focus sur l'input à l'ouverture
  useEffect(() => {
    if (isOpen && input) {
      const t = setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, input]);

  // Fermeture au clavier Échap
  useEffect(() => {
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { Icon, iconClass } = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

  const getButtonClass = (variant) => {
    const base = "px-4 py-2 text-sm font-semibold rounded-lg transition-all";
    if (variant === "primary") return `${base} bg-emerald-600 hover:bg-emerald-500 text-white`;
    if (variant === "danger")  return `${base} bg-red-600 hover:bg-red-500 text-white`;
    return `${base} bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300`;
  };

  const getValue = () => (input ? (inputRef.current?.value ?? "") : undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Carte */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">

        {/* En-tête */}
        <div className="flex items-start gap-3">
          <Icon size={22} className={`${iconClass} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-900 dark:text-white text-base leading-snug">{title}</h3>
            {message && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{message}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Champ texte (mode prompt) */}
        {input && (
          <input
            ref={inputRef}
            type="text"
            defaultValue={input.defaultValue ?? ""}
            placeholder={input.placeholder}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const primary = buttons.find(b => b.variant === "primary");
                if (primary) primary.onClick(e.target.value);
              }
            }}
          />
        )}

        {/* Boutons */}
        {buttons.length > 0 && (
          <div className="flex items-center justify-end gap-2 pt-1">
            {buttons.map((btn, i) => (
              <button key={i} onClick={() => btn.onClick(getValue())} className={getButtonClass(btn.variant)}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
