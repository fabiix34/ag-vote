import { api } from "../api";

export const coproprieteService = {
  fetchBySyndic: (syndicId) =>
    api.get("/coproprietes", syndicId ? { syndicId } : undefined),

  fetchById: (id) =>
    api.get(`/coproprietes/${id}`),

  create: ({ nom, adresse }) =>
    api.post("/coproprietes", { nom, adresse }),

  updateNom: (id, nom) =>
    api.patch(`/coproprietes/${id}/nom`, { nom }),
};
