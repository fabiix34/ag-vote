/**
 * Routes copropriétés
 *
 * GET    /api/coproprietes?syndicId=…  — liste par syndic
 * GET    /api/coproprietes/:id          — détail
 * POST   /api/coproprietes             — créer
 * PATCH  /api/coproprietes/:id/nom     — renommer
 */
import { Router } from "express";
import { coproprieteService } from "../services/db.service.js";
import { requireSyndic } from "../middleware/auth.js";

const router = Router();

router.use(requireSyndic);

router.get("/", async (req, res, next) => {
  try {
    const syndicId = req.query.syndicId ?? req.syndicId;
    const { data, error } = await coproprieteService.fetchBySyndic(syndicId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await coproprieteService.fetchById(req.params.id);
    if (error) return res.status(404).json({ error: "Copropriété introuvable." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { nom, adresse } = req.body;
    if (!nom) return res.status(400).json({ error: "nom est requis." });

    const { data, error } = await coproprieteService.create(req.syndicId, nom, adresse);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/nom", async (req, res, next) => {
  try {
    const { nom } = req.body;
    if (!nom) return res.status(400).json({ error: "nom est requis." });

    const { error } = await coproprieteService.updateNom(req.params.id, nom);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
