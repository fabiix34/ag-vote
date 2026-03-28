import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Shield, Vote } from "lucide-react";
import { useDomain } from "./hooks/useDomain";
import { SyndicAuth } from "./SyndicAuth/SyndicAuth";
import { SyndicDashboard } from "./SyndicDashboard/SyndicDashboard";
import { CoproprieteSettings } from "./CoproprieteSettings/CoproprieteSettings";
import { AdminView } from "./AdminView/AdminView";
import { CoproLogin } from "./CoproLogin/CoproLogin";
import { CoproVoteView } from "./CoproVoteView/CoproVoteView";

// ============================================================
// CONFIGURATION SUPABASE
// ============================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://YOUR_PROJECT.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_ANON_KEY";
export const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const { isSyndic, isCopro } = useDomain();
  const [view, setView] = useState({ page: "loading" });

  const navigate = (page, params = {}) => setView({ page, ...params });

  // Vérifier la session syndic au démarrage (uniquement côté syndic)
  useEffect(() => {
    if (!isSyndic) {
      setView({ page: "ready" });
      return;
    }
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: syndic } = await supabase
          .from("syndics")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (syndic) {
          setView({ page: "syndic-dashboard", syndic });
          return;
        }
      }
      setView({ page: "ready" });
    };
    checkAuth();
  }, [isSyndic]);

  // ---- Spinner de chargement initial ----
  if (view.page === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ============================================================
  // VUE SYNDIC (domaine syndic.*)
  // ============================================================
  if (isSyndic) {
    // Auth / inscription
    if (view.page === "ready") {
      return (
        <SyndicAuth
          onSuccess={(syndic) => navigate("syndic-dashboard", { syndic })}
        />
      );
    }

    if (view.page === "syndic-dashboard") {
      return (
        <SyndicDashboard
          syndic={view.syndic}
          onSelectCopropriete={(cp) =>
            navigate("copropriete", { syndic: view.syndic, copropriete: cp })
          }
          onLogout={async () => {
            await supabase.auth.signOut();
            navigate("ready");
          }}
        />
      );
    }

    if (view.page === "copropriete") {
      return (
        <CoproprieteSettings
          syndic={view.syndic}
          copropriete={view.copropriete}
          onOpenAG={(ag) =>
            navigate("ag", {
              syndic: view.syndic,
              copropriete: view.copropriete,
              agSession: ag,
            })
          }
          onBack={() => navigate("syndic-dashboard", { syndic: view.syndic })}
        />
      );
    }

    if (view.page === "ag") {
      return (
        <AdminView
          copropriete={view.copropriete}
          agSession={view.agSession}
          onBack={() =>
            navigate("copropriete", {
              syndic: view.syndic,
              copropriete: view.copropriete,
            })
          }
          onEndAG={() =>
            navigate("copropriete", {
              syndic: view.syndic,
              copropriete: view.copropriete,
            })
          }
        />
      );
    }
  }

  // ============================================================
  // VUE COPROPRIÉTAIRE (domaine copro.*)
  // ============================================================
  if (isCopro) {
    if (view.page === "ready" || view.page === "copro-login") {
      return (
        <CoproLogin
          onLogin={(profile, agSession) =>
            navigate("copro-vote", { coproProfile: profile, agSession })
          }
        />
      );
    }

    if (view.page === "copro-vote") {
      return (
        <CoproVoteView
          profile={view.coproProfile}
          agSession={view.agSession}
          onLogout={async () => {
            if (view.coproProfile) {
              await supabase
                .from("coproprietaires")
                .update({ presence: false })
                .eq("id", view.coproProfile.id);
            }
            localStorage.removeItem("copro_profile");
            navigate("ready");
          }}
        />
      );
    }
  }

  // ============================================================
  // PAGE PAR DÉFAUT (ni syndic.* ni copro.*)
  // ============================================================
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/30">
          <Shield size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">AG-Copro</h1>
        <p className="text-zinc-500 text-sm">Gestion d'assemblées générales de copropriété</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <a
          href={window.location.href.replace(window.location.hostname, "syndic." + window.location.hostname)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Shield size={18} />
          Espace Syndic
        </a>
        <a
          href={window.location.href.replace(window.location.hostname, "copro." + window.location.hostname)}
          className="w-full bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
        >
          <Vote size={18} />
          Espace Copropriétaire
        </a>
      </div>
    </div>
  );
}
