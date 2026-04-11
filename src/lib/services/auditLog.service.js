import { api } from "../api";

export const auditLogService = {
  fetchByAgSession: (agSessionId) =>
    api.get("/audit-logs", { agSessionId }),

  fetchByCopropriete: (ids) =>
    api.get("/audit-logs/copropriete", { ids: Array.isArray(ids) ? ids.join(",") : ids }),

  logAuth: ({ coproId, agSessionId, eventType, metadata }) =>
    api.post("/audit-logs/auth", { coproId, agSessionId, eventType, metadata }),

  logPresence: ({ agSessionId, coproId, arrived, details }) =>
    api.post("/audit-logs/presence", { agSessionId, coproId, arrived, details }),

  logQuotaViolation: ({ agSessionId, mandataireId, detail }) =>
    api.post("/audit-logs/quota-violation", { agSessionId, mandataireId, detail }),

  logPouvoirDonne: ({ agSessionId, mandantId, details }) =>
    api.post("/audit-logs/pouvoir-donne", { agSessionId, mandantId, details }),

  logPouvoirRevoque: ({ agSessionId, coproId, details }) =>
    api.post("/audit-logs/pouvoir-revoque", { agSessionId, coproId, details }),

  logPouvoirCancelledManual: ({ agSessionId, mandantId, pouvoirId, mandataireId, tantiemes }) =>
    api.post("/audit-logs/pouvoir-cancelled-manual", {
      agSessionId, mandantId, pouvoirId, mandataireId, tantiemes,
    }),

  logPouvoirCreatedSyndic: ({ agSessionId, mandantId, details }) =>
    api.post("/audit-logs/pouvoir-created-syndic", { agSessionId, mandantId, details }),

  logPouvoirDeletedSyndic: ({ agSessionId, mandantId, details }) =>
    api.post("/audit-logs/pouvoir-deleted-syndic", { agSessionId, mandantId, details }),
};
