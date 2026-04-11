/**
 * Routes résolutions
 *
 * GET    /api/resolutions?agSessionId=…   — liste (syndic + copropriétaire)
 * POST   /api/resolutions                 — créer
 * PATCH  /api/resolutions/:id             — mettre à jour
 * PATCH  /api/resolutions/:id/statut      — changer le statut
 * POST   /api/resolutions/pause-others    — mettre en_attente toutes les résolutions en_cours
 * POST   /api/resolutions/close-all       — fermer toutes les résolutions actives
 * DELETE /api/resolutions/:id             — supprimer
 */
import { Router } from "express";
import { resolutionService } from "../services/db.service.js";
import { requireSyndic, requireAuth } from "../middleware/auth.js";

const router = Router();

// Lecture accessible aux syndics et copropriétaires
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId } = req.query;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { data, error } = await resolutionService.fetchByAgSession(agSessionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Mutations réservées au syndic
router.post("/pause-others", requireSyndic, async (req, res, next) => {
  try {
    const { error } = await resolutionService.pauseOthers();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/close-all", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId } = req.body;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { error } = await resolutionService.closeAllActive(agSessionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId, ...payload } = req.body;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { data, error } = await resolutionService.create(agSessionId, payload);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireSyndic, async (req, res, next) => {
  try {
    const { error } = await resolutionService.update(req.params.id, req.body);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/statut", requireSyndic, async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!statut) return res.status(400).json({ error: "statut est requis." });

    const { error } = await resolutionService.updateStatut(req.params.id, statut);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireSyndic, async (req, res, next) => {
  try {
    const { error } = await resolutionService.delete(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
