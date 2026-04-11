import { useRef } from 'react';
import { extractPlaceholders, splitByPlaceholders, formatLabel } from './templates.js';

export function PlaceholderEditor({ rawText, onRawTextChange, values, onValuesChange }) {
  const inputRefs = useRef({});

  // Synchronise le nettoyage des valeurs obsolètes lors d'un changement de texte manuel
  const handleTextChange = (text) => {
    onRawTextChange(text);
    const active = new Set(extractPlaceholders(text));
    const cleaned = Object.fromEntries(
      Object.entries(values).filter(([k]) => active.has(k))
    );
    if (Object.keys(cleaned).length !== Object.keys(values).length) {
      onValuesChange(cleaned);
    }
  };

  const placeholders = extractPlaceholders(rawText);
  const parts = splitByPlaceholders(rawText);
  
  // Calcul de la progression
  const filledCount = placeholders.filter(k => values[k]?.trim()).length;
  const missingCount = placeholders.length - filledCount;
  const allFilled = placeholders.length > 0 && missingCount === 0;

  return (
    <div className="space-y-3">
      {/* 1. Éditeur de texte brut (Textarea) */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-1">
          Corps de la résolution
        </label>
        <textarea
          className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none font-sans min-h-[100px] transition-all"
          placeholder="Rédigez ici ou utilisez {{variable}}..."
          value={rawText}
          onChange={e => handleTextChange(e.target.value)}
        />
      </div>

      {/* 2. Zone Magique (visible si placeholders détectés) */}
      {placeholders.length > 0 && (
        <div className={`border rounded-xl p-4 space-y-4 transition-all duration-300 ${
          allFilled
            ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/10'
            : 'border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10 shadow-sm'
        }`}>
          
          {/* Section Aperçu avec badges cliquables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Aperçu en temps réel</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                allFilled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {filledCount}/{placeholders.length} CHAMPS REMPLIS
              </span>
            </div>
            
            <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-white dark:border-zinc-800 shadow-inner italic">
              {parts.map((part, i) => {
                if (part.type === 'text') return <span key={i}>{part.text}</span>;
                const val = values[part.key]?.trim();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => inputRefs.current[part.key]?.focus()}
                    className={`inline-flex items-center mx-0.5 px-2 py-0.5 rounded text-[11px] font-bold transition-all transform hover:scale-105 ${
                      val
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700'
                    }`}
                  >
                    {val || `[${formatLabel(part.key)}]`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section Formulaire Dynamique */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Détails à compléter</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {placeholders.map(key => {
                const isFilled = values[key]?.trim();
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                      {formatLabel(key)}
                      {!isFilled && <span className="text-amber-500 animate-pulse text-lg leading-none">*</span>}
                    </label>
                    <input
                      ref={el => { inputRefs.current[key] = el; }}
                      className={`w-full bg-white dark:bg-zinc-900 border rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none transition-all ${
                        isFilled
                          ? 'border-emerald-300 dark:border-emerald-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                          : 'border-zinc-300 dark:border-zinc-700 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400'
                      }`}
                      placeholder={`Saisir ${formatLabel(key)}...`}
                      value={values[key] || ''}
                      onChange={e => onValuesChange({ ...values, [key]: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}