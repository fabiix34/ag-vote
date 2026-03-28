import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
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
// UTILITAIRES
// ============================================================
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

async function getSyndicFromSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data } = await supabase.from("syndics").select("*").eq("id", session.user.id).single();
  return data || null;
}

// ============================================================
// ROUTES SYNDIC
// ============================================================

function SyndicAuthPage() {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSyndicFromSession().then((syndic) => {
      if (syndic) navigate("/dashboard", { replace: true });
      else setReady(true);
    });
  }, [navigate]);

  if (!ready) return <PageLoader />;
  return <SyndicAuth onSuccess={() => navigate("/dashboard")} />;
}

function SyndicDashboardPage() {
  const [syndic, setSyndic] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    getSyndicFromSession().then((s) => {
      if (!s) navigate("/", { replace: true });
      else setSyndic(s);
    });
  }, [navigate]);

  if (!syndic) return <PageLoader />;
  return (
    <SyndicDashboard
      syndic={syndic}
      onSelectCopropriete={(cp) => navigate(`/copropriete/${cp.id}`)}
      onLogout={async () => {
        await supabase.auth.signOut();
        navigate("/", { replace: true });
      }}
    />
  );
}

function CoproprieteSettingsPage() {
  const { id } = useParams();
  const [syndic, setSyndic] = useState(null);
  const [copropriete, setCopropriete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const s = await getSyndicFromSession();
      if (!s) { navigate("/", { replace: true }); return; }
      const { data: cp } = await supabase.from("coproprietes").select("*").eq("id", id).single();
      if (!cp) { navigate("/dashboard", { replace: true }); return; }
      setSyndic(s);
      setCopropriete(cp);
    };
    load();
  }, [id, navigate]);

  if (!syndic || !copropriete) return <PageLoader />;
  return (
    <CoproprieteSettings
      syndic={syndic}
      copropriete={copropriete}
      onOpenAG={(ag) => navigate(`/ag/${ag.id}`)}
      onBack={() => navigate("/dashboard")}
    />
  );
}

function AdminViewPage() {
  const { id } = useParams();
  const [copropriete, setCopropriete] = useState(null);
  const [agSession, setAgSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const s = await getSyndicFromSession();
      if (!s) { navigate("/", { replace: true }); return; }
      const { data: ag } = await supabase
        .from("ag_sessions")
        .select("*, coproprietes(*)")
        .eq("id", id)
        .single();
      if (!ag) { navigate("/dashboard", { replace: true }); return; }
      setAgSession(ag);
      setCopropriete(ag.coproprietes);
    };
    load();
  }, [id, navigate]);

  if (!agSession || !copropriete) return <PageLoader />;
  return (
    <AdminView
      copropriete={copropriete}
      agSession={agSession}
      onBack={() => navigate(`/copropriete/${copropriete.id}`)}
      onEndAG={() => navigate(`/copropriete/${copropriete.id}`)}
    />
  );
}

// ============================================================
// ROUTES COPROPRIÉTAIRE
// ============================================================

function CoproRootPage() {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("copro_profile");
    if (stored) navigate("/vote", { replace: true });
    else setReady(true);
  }, [navigate]);

  if (!ready) return <PageLoader />;
  return <CoproLogin onLogin={() => navigate("/vote")} />;
}

function CoproVotePage() {
  const [profile, setProfile] = useState(null);
  const [agSession, setAgSession] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const stored = localStorage.getItem("copro_profile");
      if (!stored) { navigate("/", { replace: true }); return; }
      const p = JSON.parse(stored);
      setProfile(p);
      if (p.copropriete_id) {
        const { data: ag } = await supabase
          .from("ag_sessions")
          .select("*")
          .eq("copropriete_id", p.copropriete_id)
          .eq("statut", "en_cours")
          .single();
        setAgSession(ag || null);
      }
      setReady(true);
    };
    load();
  }, [navigate]);

  if (!ready) return <PageLoader />;
  return (
    <CoproVoteView
      profile={profile}
      agSession={agSession}
      onLogout={async () => {
        if (profile) {
          await supabase.from("coproprietaires").update({ presence: false }).eq("id", profile.id);
        }
        localStorage.removeItem("copro_profile");
        navigate("/", { replace: true });
      }}
    />
  );
}

// ============================================================
// PAGE PAR DÉFAUT (ni syndic.* ni copro.*)
// ============================================================
function GuestPage() {
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

// ============================================================
// APP ROOT
// ============================================================
export default function App() {
  const { isSyndic, isCopro } = useDomain();

  return (
    <BrowserRouter>
      <Routes>
        {isSyndic && (
          <>
            <Route path="/" element={<SyndicAuthPage />} />
            <Route path="/dashboard" element={<SyndicDashboardPage />} />
            <Route path="/copropriete/:id" element={<CoproprieteSettingsPage />} />
            <Route path="/ag/:id" element={<AdminViewPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
        {isCopro && (
          <>
            <Route path="/" element={<CoproRootPage />} />
            <Route path="/vote" element={<CoproVotePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
        {!isSyndic && !isCopro && (
          <Route path="*" element={<GuestPage />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
