import { api } from "../api";

export const coproprietaireService = {
  fetchByCopropriete: (coproprieteId) =>
    api.get("/coproprietaires", { coproprieteId }),

  fetchTantiemes: (coproprieteId) =>
    api.get("/coproprietaires/tantiemes", { coproprieteId }),

  create: ({ coproprieteId, ...payload }) =>
    api.post("/coproprietaires", { coproprieteId, ...payload }),

  import: (rows) =>
    api.post("/coproprietaires/import", { rows }),

  update: (id, payload) =>
    api.patch(`/coproprietaires/${id}`, payload),

  setPresence: (id, presence) =>
    api.patch(`/coproprietaires/${id}/presence`, { presence }),

  resetPresence: (coproprieteId) =>
    api.post("/coproprietaires/reset-presence", { coproprieteId }),

  delete: (id) =>
    api.del(`/coproprietaires/${id}`),
};
