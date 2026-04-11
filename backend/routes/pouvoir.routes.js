/**
 * Routes pouvoirs (mandats de vote)
 *
 * GET    /api/pouvoirs?agSessionId=…              — liste des pouvoirs d'une AG
 * GET    /api/pouvoirs/mandataire/:id?agSessionId=… — pouvoirs reçus par un mandataire
 * GET    /api/pouvoirs/donne/:mandantId?agSessionId=… — pouvoir donné par un mandant
 * GET    /api/pouvoirs/historique/:agSessionId    — historique complet (PV)
 * POST   /api/pouvoirs                            — créer (simple)
 * POST   /api/pouvoirs/chain                      — créer avec transfert de chaîne (RPC)
 * PATCH  /api/pouvoirs/:id/votes-imposes          — mettre à jour les votes imposés
 * DELETE /api/pouvoirs/:id                        — soft-delete
 *
 * Cycle de vie (RPCs)
 * POST   /api/pouvoirs/check-quota
 * GET    /api/pouvoirs/weight/:userId/:resolutionId
 * POST   /api/pouvoirs/recovery
 * POST   /api/pouvoirs/redonation
 */
import { Router } from "express";
import { pouvoirService } from "../services/db.service.js";
import { requireSyndic, requireCopro, requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Lecture ───────────────────────────────────────────────────────────────────

router.get("/", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId } = req.query;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { data, error } = await pouvoirService.fetchByAgSession(agSessionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/historique/:agSessionId", requireSyndic, async (req, res, next) => {
  try {
    const { data, error } = await pouvoirService.fetchHistoriqueByAgSession(
      req.params.agSessionId
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/mandataire/:id", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId } = req.query;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { data, error } = await pouvoirService.fetchForMandataire(
      agSessionId,
      req.params.id
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/donne/:mandantId", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId } = req.query;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { data, error } = await pouvoirService.fetchDonne(
      agSessionId,
      req.params.mandantId
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Poids de vote dynamique
router.get("/weight/:userId/:resolutionId", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await pouvoirService.getVotingWeight(
      req.params.userId,
      req.params.resolutionId
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Création ──────────────────────────────────────────────────────────────────

router.post("/", requireSyndic, async (req, res, next) => {
  try {
    const { mandantId, mandataireId, agSessionId } = req.body;
    if (!mandantId || !mandataireId || !agSessionId) {
      return res.status(400).json({ error: "mandantId, mandataireId et agSessionId sont requis." });
    }
    const { data, error } = await pouvoirService.create(mandantId, mandataireId, agSessionId);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/chain", requireAuth, async (req, res, next) => {
  try {
    const { mandantId, mandataireId, agSessionId } = req.body;
    if (!mandantId || !mandataireId || !agSessionId) {
      return res.status(400).json({ error: "mandantId, mandataireId et agSessionId sont requis." });
    }
    const { data, error } = await pouvoirService.createWithChain(
      mandantId, mandataireId, agSessionId
    );
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── Vérification quota art. 22 ────────────────────────────────────────────────

router.post("/check-quota", requireAuth, async (req, res, next) => {
  try {
    const { mandataireId, agSessionId, newMandantId } = req.body;
    if (!mandataireId || !agSessionId || !newMandantId) {
      return res.status(400).json({ error: "mandataireId, agSessionId et newMandantId sont requis." });
    }
    const { data, error } = await pouvoirService.checkQuota(
      mandataireId, agSessionId, newMandantId
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Cycle de vie ──────────────────────────────────────────────────────────────

router.post("/recovery", requireAuth, async (req, res, next) => {
  try {
    const { coproId, currentResolutionId } = req.body;
    if (!coproId) return res.status(400).json({ error: "coproId est requis." });

    const { data, error } = await pouvoirService.handleRecovery(coproId, currentResolutionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/redonation", requireAuth, async (req, res, next) => {
  try {
    const { fromId, toId, currentResolutionId } = req.body;
    if (!fromId || !toId) {
      return res.status(400).json({ error: "fromId et toId sont requis." });
    }
    const { data, error } = await pouvoirService.handleRedonation(
      fromId, toId, currentResolutionId
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Mise à jour ───────────────────────────────────────────────────────────────

router.patch("/:id/votes-imposes", requireAuth, async (req, res, next) => {
  try {
    const { votesImposes } = req.body;
    if (!votesImposes) return res.status(400).json({ error: "votesImposes est requis." });

    const { error } = await pouvoirService.updateVotesImposes(
      req.params.id,
      votesImposes
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Suppression (soft-delete) ─────────────────────────────────────────────────

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { error } = await pouvoirService.softDelete(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
