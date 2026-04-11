import { api } from "../api";

export const pouvoirService = {
  fetchByAgSession: (agSessionId) =>
    api.get("/pouvoirs", { agSessionId }),

  fetchHistorique: (agSessionId) =>
    api.get(`/pouvoirs/historique/${agSessionId}`),

  fetchForMandataire: (id, agSessionId) =>
    api.get(`/pouvoirs/mandataire/${id}`, { agSessionId }),

  fetchDonne: (mandantId, agSessionId) =>
    api.get(`/pouvoirs/donne/${mandantId}`, { agSessionId }),

  getVotingWeight: (userId, resolutionId) =>
    api.get(`/pouvoirs/weight/${userId}/${resolutionId}`),

  create: ({ mandantId, mandataireId, agSessionId }) =>
    api.post("/pouvoirs", { mandantId, mandataireId, agSessionId }),

  createWithChain: ({ mandantId, mandataireId, agSessionId }) =>
    api.post("/pouvoirs/chain", { mandantId, mandataireId, agSessionId }),

  checkQuota: ({ mandataireId, agSessionId, newMandantId }) =>
    api.post("/pouvoirs/check-quota", { mandataireId, agSessionId, newMandantId }),

  recovery: ({ coproId, currentResolutionId }) =>
    api.post("/pouvoirs/recovery", { coproId, currentResolutionId }),

  redonation: ({ fromId, toId, currentResolutionId }) =>
    api.post("/pouvoirs/redonation", { fromId, toId, currentResolutionId }),

  updateVotesImposes: (id, votesImposes) =>
    api.patch(`/pouvoirs/${id}/votes-imposes`, { votesImposes }),

  softDelete: (id) =>
    api.del(`/pouvoirs/${id}`),
};
