import { api } from "../api";

export const resolutionService = {
  fetchByAgSession: (agSessionId) =>
    api.get("/resolutions", { agSessionId }),

  create: ({ agSessionId, ...payload }) =>
    api.post("/resolutions", { agSessionId, ...payload }),

  update: (id, payload) =>
    api.patch(`/resolutions/${id}`, payload),

  updateStatut: (id, statut) =>
    api.patch(`/resolutions/${id}/statut`, { statut }),

  pauseOthers: () =>
    api.post("/resolutions/pause-others"),

  closeAll: (agSessionId) =>
    api.post("/resolutions/close-all", { agSessionId }),

  delete: (id) =>
    api.del(`/resolutions/${id}`),
};
