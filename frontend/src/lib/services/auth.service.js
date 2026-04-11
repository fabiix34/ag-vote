import { api } from "../api";

export const authService = {
  syndicRegister: ({ email, password, nom, prenom }) =>
    api.post("/auth/syndic/register", { email, password, nom, prenom }),

  syndicLogin: ({ email, password }) =>
    api.post("/auth/syndic/login", { email, password }),

  syndicLogout: () =>
    api.post("/auth/syndic/logout"),

  coproLogin: ({ email, dateNaissance, agSessionId }) =>
    api.post("/auth/copro/login", { email, dateNaissance, agSessionId }),
};
