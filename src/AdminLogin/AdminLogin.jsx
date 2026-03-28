// ============================================================
// COMPOSANT : Login Admin
// ============================================================

import { useState } from "react";
import { Lock } from "lucide-react";


const ADMIN_CODE = "SYNDIC2024"; // Code admin simple pour le MVP

export function AdminLogin({ onLogin }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (code === ADMIN_CODE) {
      localStorage.setItem("admin_auth", "1");
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-6">
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="w-14 h-14 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto">
          <Lock size={24} className="text-zinc-500 dark:text-zinc-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Accès Syndic</h1>
          <p className="text-zinc-500 text-sm mt-1">Saisir le code administrateur</p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            className={`w-full bg-white dark:bg-zinc-900 border rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-center text-2xl font-mono tracking-widest focus:outline-none transition-colors ${
              error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700 focus:border-emerald-500"
            }`}
            placeholder="••••••••"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          {error && <p className="text-red-400 text-sm">Code incorrect</p>}
          <button
            onClick={handleSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Connexion
          </button>
        </div>
      </div>
    </div>
  );
}