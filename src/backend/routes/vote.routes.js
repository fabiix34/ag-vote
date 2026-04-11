/**
 * Routes votes
 *
 * GET  /api/votes?resolutionIds=…  — votes pour une liste de résolutions
 * GET  /api/votes/copro/:coproId   — votes d'un copropriétaire
 * POST /api/votes/vpc              — vote par correspondance (RPC atomique)
 * POST /api/votes/live             — vote en séance (RPC atomique)
 * POST /api/votes/syndic           — vote manuel par le syndic (RPC atomique)
 * DELETE /api/votes                — supprimer un vote
 */
import { Router } from "express";
import { voteService } from "../services/db.service.js";
import { requireSyndic, requireCopro, requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Lecture ───────────────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const ids = req.query.resolutionIds;
    if (!ids) return res.status(400).json({ error: "resolutionIds est requis." });

    const resolutionIds = Array.isArray(ids) ? ids : ids.split(",");
    const { data, error } = await voteService.fetchByResolutions(resolutionIds);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/copro/:coproId", requireCopro, async (req, res, next) => {
  try {
    const { data, error } = await voteService.fetchByCopro(req.params.coproId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── RPCs atomiques ────────────────────────────────────────────────────────────

// Vote par correspondance (période vote_anticipe)
router.post("/vpc", requireCopro, async (req, res, next) => {
  try {
    const { voterId, resolutionId, choix, mandantIds, metadata } = req.body;
    if (!voterId || !resolutionId || !choix) {
      return res.status(400).json({ error: "voterId, resolutionId et choix sont requis." });
    }
    const { data, error } = await voteService.submitVpc(
      voterId, resolutionId, choix, mandantIds, metadata
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Vote en séance
router.post("/live", requireCopro, async (req, res, next) => {
  try {
    const { voterId, resolutionId, choix, mandantIds, metadata } = req.body;
    if (!voterId || !resolutionId || !choix) {
      return res.status(400).json({ error: "voterId, resolutionId et choix sont requis." });
    }
    const { data, error } = await voteService.submitLive(
      voterId, resolutionId, choix, mandantIds, metadata
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Vote manuel par le syndic
router.post("/syndic", requireSyndic, async (req, res, next) => {
  try {
    const { coproId, resolutionId, choix, mandantIds, metadata } = req.body;
    if (!coproId || !resolutionId || !choix) {
      return res.status(400).json({ error: "coproId, resolutionId et choix sont requis." });
    }
    const { data, error } = await voteService.submitManualSyndic(
      req.syndicId, coproId, resolutionId, choix, mandantIds, metadata
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Upsert vote simple (vote imposé par un mandant)
router.post("/upsert", requireAuth, async (req, res, next) => {
  try {
    const { coproId, resolutionId, choix, tantiemes } = req.body;
    if (!coproId || !resolutionId || !choix) {
      return res.status(400).json({ error: "coproId, resolutionId et choix sont requis." });
    }
    const { data, error } = await voteService.upsert(coproId, resolutionId, choix, tantiemes);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? { success: true });
  } catch (err) {
    next(err);
  }
});

// ── Suppression ───────────────────────────────────────────────────────────────

router.delete("/", requireSyndic, async (req, res, next) => {
  try {
    const { coproId, resolutionId } = req.body;
    if (!coproId || !resolutionId) {
      return res.status(400).json({ error: "coproId et resolutionId sont requis." });
    }
    const { error } = await voteService.delete(coproId, resolutionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
