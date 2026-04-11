import express from "express";
import cors from "cors";
import { config } from "./config.js"; // On importe l'objet exporté
import router from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Configuration du CORS en utilisant la config importée
app.use(cors({ 
  origin: config.corsOrigin, 
  credentials: true 
}));

app.use(express.json());

// Routes
app.use("/api", router);

// Gestion d'erreurs
app.use(errorHandler);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`✅ Backend démarré sur le port ${config.port}`);
  console.log(`🌍 Origines autorisées :`, config.corsOrigin);
});