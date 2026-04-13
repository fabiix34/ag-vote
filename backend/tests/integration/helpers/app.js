/**
 * Factory Express pour les tests d'intégration.
 * Identique à index.js mais sans app.listen().
 */
import express from "express";
import router from "../../../routes/index.js";
import { errorHandler } from "../../../middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(errorHandler);
  return app;
}
