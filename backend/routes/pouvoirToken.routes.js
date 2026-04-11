/**
 * Routes tokens pouvoir (QR code)
 *
 * GET  /api/pouvoir-tokens/pending?token=…&agSessionId=…  — token en attente
 * GET  /api/pouvoir-tokens/existing?mandantId=…&agSessionId=…  — token existant
 * POST /api/pouvoir-tokens                                 — générer un token
 * POST /api/pouvoir-tokens/:id/use                        — marquer comme utilisé
 */
import { Router } from "express";
import { pouvoirTokenService } from "../services/db.service.js";
import { requireSyndic, requireCopro, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/pending", requireCopro, async (req, res, next) => {
  try {
    const { token, agSessionId } = req.query;
    if (!token || !agSessionId) {
      return res.status(400).json({ error: "token et agSessionId sont requis." });
    }
    const { data, error } = await pouvoirTokenService.fetchPending(token, agSessionId);
    if (error) return res.status(404).json({ error: "Token introuvable ou déjà utilisé." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/existing", requireAuth, async (req, res, next) => {
  try {
    const { mandantId, agSessionId } = req.query;
    if (!mandantId || !agSessionId) {
      return res.status(400).json({ error: "mandantId et agSessionId sont requis." });
    }
    const { data, error } = await pouvoirTokenService.fetchExisting(mandantId, agSessionId);
    if (error) return res.status(404).json({ error: "Aucun token existant." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { mandantId, agSessionId } = req.body;
    if (!mandantId || !agSessionId) {
      return res.status(400).json({ error: "mandantId et agSessionId sont requis." });
    }
    const { data, error } = await pouvoirTokenService.create(mandantId, agSessionId);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/use", requireCopro, async (req, res, next) => {
  try {
    const { error } = await pouvoirTokenService.markUsed(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
