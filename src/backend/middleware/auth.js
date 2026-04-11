import { supabaseAnon, supabaseAdmin } from "../config.js";

/**
 * Middleware — vérifie le JWT Supabase d'un syndic.
 */
export async function requireSyndic(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant." });
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Token invalide ou expiré." });
  }

  req.user = data.user;
  req.syndicId = data.user.id;
  next();
}

/**
 * Middleware — vérifie l'identifiant copropriétaire (header X-Copro-Id).
 */
export async function requireCopro(req, res, next) {
  const coproId = req.headers["x-copro-id"];
  if (!coproId) {
    return res.status(401).json({ error: "Identifiant copropriétaire manquant." });
  }

  const { data, error } = await supabaseAdmin
    .from("coproprietaires")
    .select("id")
    .eq("id", coproId)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: "Copropriétaire introuvable." });
  }

  req.coproId = coproId;
  next();
}

/**
 * Middleware — accepte soit un JWT syndic soit un X-Copro-Id.
 * Utilisé sur les routes accessibles par les deux types d'utilisateurs.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const coproId    = req.headers["x-copro-id"];

  // Essai syndic JWT
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (!error && data?.user) {
      req.user     = data.user;
      req.syndicId = data.user.id;
      return next();
    }
  }

  // Essai copropriétaire
  if (coproId) {
    const { data, error } = await supabaseAdmin
      .from("coproprietaires")
      .select("id")
      .eq("id", coproId)
      .single();
    if (!error && data) {
      req.coproId = coproId;
      return next();
    }
  }

  return res.status(401).json({ error: "Authentification requise." });
}
