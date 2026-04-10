import { useState, useEffect } from "react";
import { ShieldCheck, ChevronDown, ChevronUp, Search } from "lucide-react";
import { auditLogsService } from "../services/db";
import { AuditEvent } from "../utils/auditEvent";

const EVENT_META = {
  [AuditEvent.AUTH_LOGIN]: {
    label: "Connexion",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  [AuditEvent.AUTH_LOGOUT]: {
    label: "Déconnexion",
    color: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
  },
  [AuditEvent.POWER_GIVEN]: {
    label: "Pouvoir donné",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  [AuditEvent.POWER_RECOVERED]: {
    label: "Pouvoir récupéré",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  [AuditEvent.POWER_TRANSFERRED]: {
    label: "Pouvoir transféré",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  [AuditEvent.VOTE_VPC_SUBMITTED]: {
    label: "Vote anticipé",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  [AuditEvent.VOTE_LIVE_SUBMITTED]: {
    label: "Vote en séance",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  [AuditEvent.VOTE_MANUAL_SYNDIC]: {
    label: "Vote manuel syndic",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  [AuditEvent.ATTENDANCE_ARRIVED]: {
    label: "Arrivée physique",
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  [AuditEvent.ATTENDANCE_LEFT]: {
    label: "Départ physique",
    color: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
  },
};

function EventBadge({ eventType }) {
  const meta = EVENT_META[eventType] ?? {
    label: eventType ?? "—",
    color: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
  };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function DetailsRow({ details, payload }) {
  const [open, setOpen] = useState(false);
  const data = payload ?? details;
  if (!data || Object.keys(data).length === 0) return <span className="text-zinc-400">—</span>;

  const preview = Object.entries(data)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        <span className="truncate max-w-[260px]">{preview}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2 text-zinc-600 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditTab({ agSessions, coproprietaires }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState("all");
  const [search, setSearch] = useState("");

  const agById = Object.fromEntries(agSessions.map((ag) => [ag.id, ag]));
  const coproById = Object.fromEntries(coproprietaires.map((c) => [c.id, c]));

  useEffect(() => {
    if (agSessions.length === 0) { setLoading(false); return; }
    const ids = agSessions.map((ag) => ag.id);
    auditLogsService.fetchByCopropriete(ids).then(({ data }) => {
      setLogs(data ?? []);
      setLoading(false);
    });
  }, [agSessions]);

  const coproName = (id) => {
    const c = coproById[id];
    return c ? `${c.prenom} ${c.nom}` : id ? id.slice(0, 8) + "…" : "—";
  };

  const agLabel = (id) => {
    if (!id) return "—";
    const ag = agById[id];
    if (!ag) return id.slice(0, 8) + "…";
    return "AG " + new Date(ag.date_ag).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  };

  const filtered = logs.filter((l) => {
    if (filterEvent !== "all" && l.event_type !== filterEvent) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = coproName(l.coproprietaire_id ?? l.user_id).toLowerCase();
      const ag = agLabel(l.ag_session_id).toLowerCase();
      const event = (EVENT_META[l.event_type]?.label ?? l.event_type ?? "").toLowerCase();
      const details = JSON.stringify(l.payload ?? l.details ?? "").toLowerCase();
      if (!name.includes(q) && !ag.includes(q) && !event.includes(q) && !details.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-white">Piste d'audit</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{logs.length} événement{logs.length > 1 ? "s" : ""} enregistré{logs.length > 1 ? "s" : ""}</p>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-2 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-emerald-500 w-48"
          />
        </div>
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Tous les événements</option>
          {Object.entries(EVENT_META).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <ShieldCheck size={36} className="text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">Aucun événement</p>
          <p className="text-zinc-400 text-sm mt-1">Les actions sur les AG apparaîtront ici.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Horodatage</th>
                <th className="text-left px-4 py-3 font-medium">AG</th>
                <th className="text-left px-4 py-3 font-medium">Événement</th>
                <th className="text-left px-4 py-3 font-medium">Copropriétaire</th>
                <th className="text-left px-4 py-3 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("fr-FR", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                    {agLabel(log.ag_session_id)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <EventBadge eventType={log.event_type} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                    {coproName(log.coproprietaire_id ?? log.user_id)}
                  </td>
                  <td className="px-4 py-3">
                    <DetailsRow details={log.details} payload={log.payload} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
