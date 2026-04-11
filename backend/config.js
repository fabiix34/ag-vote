import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 1. Initialisation de l'environnement
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = process.env.NODE_ENV ?? "development";
dotenvConfig({ path: resolve(__dirname, `.env.${env}`) });

console.log(`Configuration chargée pour l'environnement : ${env}`);

// 2. Export de l'objet config
export const config = {
  port: Number(process.env.PORT) || 3001,
  // Transformation propre de la chaîne du .env en tableau
  corsOrigin: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim()) 
    : ["http://localhost:5173"],
};

// 3. Export des clients Supabase
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY } = process.env;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);