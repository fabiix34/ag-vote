/**
 * Middleware de gestion d'erreurs centralisé.
 * Intercepte toutes les erreurs propagées via next(err).
 */
export function errorHandler(err, req, res, _next) {
  console.error("[errorHandler]", err);

  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Erreur interne du serveur.";

  res.status(status).json({ error: message });
}
