/**
 * Routes AG Sessions
 *
 * GET    /api/ag?coproprieteId=…        — liste des sessions d'une copropriété
 * GET    /api/ag/:id                     — détail avec copropriété
 * GET    /api/ag/:id/active             — session active d'une copropriété
 * POST   /api/ag                        — créer une session
 * PATCH  /api/ag/:id/statut             — changer le statut
 * PATCH  /api/ag/:id/vote-anticipe      — activer/désactiver le vote anticipé
 * POST   /api/ag/:id/terminate          — clôturer l'AG
 */
import { Router } from "express";
import { agSessionService, resolutionService, coproprietaireService } from "../services/db.service.js";
import { requireSyndic, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { coproprieteId } = req.query;
    if (!coproprieteId) return res.status(400).json({ error: "coproprieteId est requis." });

    const { data, error } = await agSessionService.fetchByCopropriete(coproprieteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await agSessionService.fetchWithCopropriete(req.params.id);
    if (error) return res.status(404).json({ error: "Session introuvable." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/active/:coproprieteId", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await agSessionService.fetchActive(req.params.coproprieteId);
    if (error) return res.status(404).json({ error: "Aucune session active." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireSyndic, async (req, res, next) => {
  try {
    const { coproprieteId, dateAg } = req.body;
    if (!coproprieteId) return res.status(400).json({ error: "coproprieteId est requis." });

    const { data, error } = await agSessionService.create(coproprieteId, dateAg);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/statut", requireSyndic, async (req, res, next) => {
  try {
    const { statut } = req.body;
    if (!statut) return res.status(400).json({ error: "statut est requis." });

    const { error } = await agSessionService.updateStatut(req.params.id, statut);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/vote-anticipe", requireSyndic, async (req, res, next) => {
  try {
    const { activer } = req.body;
    const fn = activer
      ? agSessionService.activateVoteAnticipe
      : agSessionService.deactivateVoteAnticipe;

    const { error } = await fn(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Clôture de l'AG : ferme les résolutions actives + remet les présences à 0
router.post("/:id/terminate", requireSyndic, async (req, res, next) => {
  try {
    const agId = req.params.id;
    const { coproprieteId } = req.body;

    const [terminateErr, closeErr, presenceErr] = await Promise.all([
      agSessionService.terminate(agId).then((r) => r.error),
      resolutionService.closeAllActive(agId).then((r) => r.error),
      coproprieteId
        ? coproprietaireService.resetAllPresence(coproprieteId).then((r) => r.error)
        : Promise.resolve(null),
    ]);

    const firstError = terminateErr || closeErr || presenceErr;
    if (firstError) return res.status(500).json({ error: firstError.message });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
