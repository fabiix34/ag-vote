import { api } from "../api";

export const templateService = {
  fetchAll: () =>
    api.get("/templates"),

  create: ({ titre, description, categorie }) =>
    api.post("/templates", { titre, description, categorie }),

  update: (id, { titre, description, categorie }) =>
    api.patch(`/templates/${id}`, { titre, description, categorie }),

  delete: (id) =>
    api.del(`/templates/${id}`),
};
