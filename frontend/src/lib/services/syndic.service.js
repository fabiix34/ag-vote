import { api } from "../api";

export const syndicService = {
  fetch: (id) =>
    api.get(`/syndics/${id}`),

  create: ({ userId, email, nom, prenom }) =>
    api.post("/syndics", { userId, email, nom, prenom }),
};
