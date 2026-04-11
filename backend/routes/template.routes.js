/**
 * Routes modèles de résolutions
 *
 * GET    /api/templates       — liste tous les modèles
 * POST   /api/templates       — créer un modèle personnalisé
 * PATCH  /api/templates/:id   — mettre à jour
 * DELETE /api/templates/:id   — supprimer
 */
import { Router } from "express";
import { templateService } from "../services/db.service.js";
import { requireSyndic } from "../middleware/auth.js";

const router = Router();

router.use(requireSyndic);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await templateService.fetchAll();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { titre, description, categorie } = req.body;
    if (!titre || !categorie || !description) {
      return res.status(400).json({ error: "titre, description et categorie sont requis." });
    }
    const { data, error } = await templateService.create({ titre, description, categorie });
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { titre, description, categorie } = req.body;
    const { data, error } = await templateService.update(
      req.params.id,
      { titre, description, categorie }
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await templateService.delete(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
