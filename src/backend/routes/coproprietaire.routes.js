/**
 * Routes copropriétaires
 *
 * GET    /api/coproprietaires?coproprieteId=…   — liste
 * POST   /api/coproprietaires                   — créer
 * POST   /api/coproprietaires/import            — import en masse (upsert)
 * PATCH  /api/coproprietaires/:id               — mise à jour
 * PATCH  /api/coproprietaires/:id/presence      — toggler présence
 * POST   /api/coproprietaires/reset-presence    — remettre toutes les présences à false
 * DELETE /api/coproprietaires/:id               — supprimer
 */
import { Router } from "express";
import { coproprietaireService } from "../services/db.service.js";
import { requireSyndic, requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { coproprieteId } = req.query;
    if (!coproprieteId) return res.status(400).json({ error: "coproprieteId est requis." });

    const { data, error } = await coproprietaireService.fetchByCopropriete(coproprieteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/tantiemes", requireAuth, async (req, res, next) => {
  try {
    const { coproprieteId } = req.query;
    if (!coproprieteId) return res.status(400).json({ error: "coproprieteId est requis." });

    const { data, error } = await coproprietaireService.fetchTantiemes(coproprieteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireSyndic, async (req, res, next) => {
  try {
    const { coproprieteId, ...payload } = req.body;
    if (!coproprieteId) return res.status(400).json({ error: "coproprieteId est requis." });

    const { error } = await coproprietaireService.create(coproprieteId, payload);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/import", requireSyndic, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "rows est requis et doit être un tableau." });
    }
    const { error } = await coproprietaireService.upsertMany(rows);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: rows.length });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireSyndic, async (req, res, next) => {
  try {
    const { error } = await coproprietaireService.update(req.params.id, req.body);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/presence", requireAuth, async (req, res, next) => {
  try {
    const { presence } = req.body;
    if (typeof presence !== "boolean") {
      return res.status(400).json({ error: "presence (boolean) est requis." });
    }
    const { error } = await coproprietaireService.setPresence(req.params.id, presence);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-presence", requireSyndic, async (req, res, next) => {
  try {
    const { coproprieteId } = req.body;
    if (!coproprieteId) return res.status(400).json({ error: "coproprieteId est requis." });

    const { error } = await coproprietaireService.resetAllPresence(coproprieteId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireSyndic, async (req, res, next) => {
  try {
    const { error } = await coproprietaireService.delete(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
