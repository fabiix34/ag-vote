import { api } from "../api";

export const documentService = {
  fetchByResolution: (resolutionId) =>
    api.get("/documents", { resolutionId }),

  getSignedUrls: (paths, expiresIn) =>
    api.post("/documents/signed-urls", { paths, expiresIn }),

  create: ({ resolutionId, nom, path }) =>
    api.post("/documents", { resolutionId, nom, path }),

  delete: (id) =>
    api.del(`/documents/${id}`),
};
