// ============================================================
// COMPOSANT : Authentification Syndic (Login / Inscription)
// ============================================================

import { useState } from "react";
import { Shield, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { syndicService } from "../services/db";

export function SyndicAuth({ onSuccess, onBack = null }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    if (mode === "register" && (!nom.trim() || !prenom.trim())) {
      setError("Veuillez renseigner votre nom et prénom");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
        options: {
          redirectTo: `${window.location.origin}`, // Redirection après connexion
        },
      });
      if (authErr) {
        setError("Email ou mot de passe incorrect");
        setLoading(false);
        return;
      }
      const { data: syndic, error: syndicErr } = await syndicService.fetch(data.user.id);
      if (syndicErr || !syndic) {
        setError("Compte syndic introuvable. Vérifiez vos identifiants.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      onSuccess(syndic);
    } else {
      // Inscription
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpErr) {
        setError(signUpErr.message);
        setLoading(false);
        return;
      }
      const { data: syndic, error: insertErr } = await syndicService.create(data.user.id, email.trim(), nom.trim(), prenom.trim());
      if (insertErr) {
        setError("Erreur lors de la création du profil syndic");
        setLoading(false);
        return;
      }
      onSuccess(syndic);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Retour (optionnel) */}
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
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Espace Syndic</h1>
          <p className="text-zinc-500 text-sm">
            {mode === "login" ? "Connectez-vous à votre espace" : "Créez votre compte syndic"}
          </p>
        </div>

        {/* Bascule login / inscription */}
        <div className="flex rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-emerald-600 text-white"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === "register"
                ? "bg-emerald-600 text-white"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            Créer un compte
          </button>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          {mode === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Prénom
                </label>
                <input
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Marie"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                  Nom
                </label>
                <input
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Dupont"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
              placeholder="syndic@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 pr-12 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === "register" && (
              <p className="text-xs text-zinc-400">Minimum 6 caractères</p>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
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
                {mode === "login" ? "Connexion..." : "Création..."}
              </>
            ) : mode === "login" ? (
              "Se connecter"
            ) : (
              "Créer mon compte"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
