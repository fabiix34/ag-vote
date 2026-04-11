import { api } from "../api";

export const agService = {
  fetchByCopropriete: (coproprieteId) =>
    api.get("/ag", { coproprieteId }),

  fetchById: (id) =>
    api.get(`/ag/${id}`),

  fetchActive: (coproprieteId) =>
    api.get(`/ag/active/${coproprieteId}`),

  create: ({ coproprieteId, dateAg }) =>
    api.post("/ag", { coproprieteId, dateAg }),

  updateStatut: (id, statut) =>
    api.patch(`/ag/${id}/statut`, { statut }),

  toggleVoteAnticipe: (id, activer) =>
    api.patch(`/ag/${id}/vote-anticipe`, { activer }),

  terminate: (id, coproprieteId) =>
    api.post(`/ag/${id}/terminate`, { coproprieteId }),
};
