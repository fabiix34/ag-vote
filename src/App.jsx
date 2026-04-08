import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { useDomain } from "./hooks/useDomain";
import { supabase } from "./lib/supabase";
import { syndicService, coproprieteService, agSessionService, coproprietaireService, logsAgService, auditLogsService } from "./services/db";
import { SyndicAuth } from "./SyndicAuth/SyndicAuth";
import { SyndicDashboard } from "./SyndicDashboard/SyndicDashboard";
import { CoproprieteSettings } from "./CoproprieteSettings/CoproprieteSettings";
import { AdminView } from "./AdminView/AdminView";
import { CoproLogin } from "./CoproLogin/CoproLogin";
import { CoproVoteView } from "./CoproVoteView/CoproVoteView";

export { supabase };

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
  const { data } = await syndicService.fetch(session.user.id);
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
      const { data: cp } = await coproprieteService.fetchById(id);
      if (!cp) { navigate("/dashboard", { replace: true }); return; }
      setSyndic(s);
      setCopropriete(cp);
    };
    load();
  }, [id, navigate]);

  if (!syndic || !copropriete) return <PageLoader />;
  return (
    <CoproprieteSettings
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
  const [syndicId, setSyndicId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const s = await getSyndicFromSession();
      if (!s) { navigate("/", { replace: true }); return; }
      setSyndicId(s.id);
      const { data: ag } = await agSessionService.fetchWithCopropriete(id);
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
      syndicId={syndicId}
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
    // Conserver le token pouvoir en session avant redirection
    const params = new URLSearchParams(window.location.search);
    const token = params.get("pouvoir");
    if (token) sessionStorage.setItem("pending_pouvoir_token", token);

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
        const { data: ag } = await agSessionService.fetchActive(p.copropriete_id);
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
          await Promise.all([
            coproprietaireService.setPresence(profile.id, false),
            auditLogsService.logAuthEvent(profile.id, agSession?.id ?? null, "AUTH_LOGOUT"),
          ]);
        }
        localStorage.removeItem("copro_profile");
        navigate("/", { replace: true });
      }}
    />
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
