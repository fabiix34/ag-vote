/**
 * Routes syndic
 *
 * GET  /api/syndics/:id   — profil d'un syndic
 * POST /api/syndics       — créer un profil syndic après inscription Supabase Auth
 */
import { Router } from "express";
import { syndicService } from "../services/db.service.js";
import { requireSyndic } from "../middleware/auth.js";

const router = Router();

router.get("/:id", requireSyndic, async (req, res, next) => {
  try {
    if (req.syndicId !== req.params.id) {
      return res.status(403).json({ error: "Accès refusé." });
    }
    const { data, error } = await syndicService.fetch(req.params.id);
    if (error) return res.status(404).json({ error: "Syndic introuvable." });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireSyndic, async (req, res, next) => {
  try {
    const { userId, email, nom, prenom } = req.body;
    if (!userId || !email || !nom || !prenom) {
      return res.status(400).json({ error: "userId, email, nom et prenom sont requis." });
    }
    const { data, error } = await syndicService.create(userId, email, nom, prenom);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
