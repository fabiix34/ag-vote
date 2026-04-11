import { api } from "../api";

export const pouvoirTokenService = {
  fetchPending: ({ token, agSessionId }) =>
    api.get("/pouvoir-tokens/pending", { token, agSessionId }),

  fetchExisting: ({ mandantId, agSessionId }) =>
    api.get("/pouvoir-tokens/existing", { mandantId, agSessionId }),

  create: ({ mandantId, agSessionId }) =>
    api.post("/pouvoir-tokens", { mandantId, agSessionId }),

  markUsed: (id) =>
    api.post(`/pouvoir-tokens/${id}/use`),
};
