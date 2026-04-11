/**
 * Routes documents (pièces jointes des résolutions)
 *
 * GET    /api/documents?resolutionId=…       — documents d'une résolution
 * GET    /api/documents/signed-urls          — URLs signées pour téléchargement
 * POST   /api/documents                      — créer (enregistrer métadonnées)
 * DELETE /api/documents/:id                  — supprimer
 */
import { Router } from "express";
import { documentService } from "../services/db.service.js";
import { requireSyndic } from "../middleware/auth.js";

const router = Router();

router.use(requireSyndic);

router.get("/", async (req, res, next) => {
  try {
    const { resolutionId } = req.query;
    if (!resolutionId) return res.status(400).json({ error: "resolutionId est requis." });

    const { data, error } = await documentService.fetchByResolution(resolutionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// Retourne des URLs signées pour une liste de chemins de stockage
router.post("/signed-urls", async (req, res, next) => {
  try {
    const { paths, expiresIn } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: "paths (tableau) est requis." });
    }
    const { data, error } = await documentService.getSignedUrls(paths, expiresIn);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { resolutionId, nom, path } = req.body;
    if (!resolutionId || !nom || !path) {
      return res.status(400).json({ error: "resolutionId, nom et path sont requis." });
    }
    const { error } = await documentService.create(resolutionId, nom, path);
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await documentService.delete(req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
