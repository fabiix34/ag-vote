import { api } from "../api";
import { isVoteAnticipe } from "../../utils/agStatut.js";

export const voteService = {
  fetchByResolutions: (resolutionIds) =>
    api.get("/votes", { resolutionIds: resolutionIds.join(",") }),

  fetchByCopro: (coproId) =>
    api.get(`/votes/copro/${coproId}`),

  submitVpc: ({ voterId, resolutionId, choix, mandantIds, metadata }) =>
    api.post("/votes/vpc", { voterId, resolutionId, choix, mandantIds, metadata }),

  submitLive: ({ voterId, resolutionId, choix, mandantIds, metadata }) =>
    api.post("/votes/live", { voterId, resolutionId, choix, mandantIds, metadata }),

  submitSyndic: ({ coproId, resolutionId, choix, mandantIds, metadata }) =>
    api.post("/votes/syndic", { coproId, resolutionId, choix, mandantIds, metadata }),

  upsert: ({ coproId, resolutionId, choix, tantiemes }) =>
    api.post("/votes/upsert", { coproId, resolutionId, choix, tantiemes }),

  delete: ({ coproId, resolutionId }) =>
    api.del("/votes", { coproId, resolutionId }),

  /**
   * Méthode "Intelligente" pour le Copropriétaire
   * Décide dynamiquement de l'endpoint (VPC vs LIVE) selon le statut de l'AG
   */
  submitCoproVote: async ({ profile, agSession, resolutionId, choix, mandantIds = [] }) => {
    // 1. Détermination du mode de vote
    const isVpc = isVoteAnticipe(agSession.statut);
    const endpoint = isVpc ? "/votes/vpc" : "/votes/live";

    // 2. Préparation du payload avec sécurité sur les mandants
    const payload = {
      voterId: profile.id,
      resolutionId,
      choix,
      mandantIds: Array.isArray(mandantIds) ? mandantIds : [],
      metadata: {
        timestamp_client: new Date().toISOString(),
        user_agent: navigator.userAgent
      }
    };

    return await api.post(endpoint, payload);
  },
};
