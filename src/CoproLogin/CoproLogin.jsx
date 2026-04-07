// ============================================================
// VUE COPROPRIÉTAIRE : Login
// ============================================================

import { useState } from "react";
import { Vote, ChevronRight, AlertCircle, ArrowLeft } from "lucide-react";
import { coproprietaireService, agSessionService, logsAgService } from "../services/db";

export function CoproLogin({ onLogin, onBack = null }) {
  const [email, setEmail] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !dateNaissance) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    setError("");

    // 1. Trouver le coproprietaire
    const { data, error: err } = await coproprietaireService.fetchByLogin(email, dateNaissance);

    if (err || !data) {
      setError("Identifiants incorrects. Vérifiez votre email et date de naissance.");
      setLoading(false);
      return;
    }

    // 2. Trouver l'AG active de leur copropriété
    let agSession = null;
    if (data.copropriete_id) {
      const { data: ag } = await agSessionService.fetchActive(data.copropriete_id);
      agSession = ag || null;
    }

    // 3. Marquer présent + logger la connexion
    await coproprietaireService.setPresence(data.id, true);
    logsAgService.insert(agSession?.id ?? null, data.id, "connexion");

    localStorage.setItem("copro_profile", JSON.stringify(data));
    onLogin(data, agSession);
  };

  const handleDateChange = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
    else if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    setDateNaissance(formatted);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Retour */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        )}

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
            <Vote size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Assemblée Générale</h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">Connectez-vous pour voter</p>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-base transition-colors"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Date de naissance (code PIN)
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-500 text-base font-mono tracking-[0.3em] transition-colors"
              placeholder="JJ/MM/AAAA"
              value={dateNaissance}
              onChange={(e) => handleDateChange(e.target.value)}
              maxLength={10}
            />
            <p className="text-xs text-zinc-500">Ex : 15/03/1975 pour le 15 mars 1975</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-4 rounded-xl text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <ChevronRight size={18} />
                Accéder au vote
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500">
          Authentification sécurisée · Pas de mot de passe requis
        </p>
      </div>
    </div>
  );
}
