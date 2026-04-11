/**
 * Route génération du Procès-Verbal
 *
 * POST /api/pv/generate
 *   Body : { resolutions, votes, coproprietaires }
 *   Réponse : fichier .docx en téléchargement direct
 */
import { Router } from "express";
import { generatePVBuffer } from "../services/pv.service.js";
import { requireSyndic } from "../middleware/auth.js";

const router = Router();

router.post("/generate", requireSyndic, async (req, res, next) => {
  try {
    const { resolutions, votes, coproprietaires } = req.body;

    if (!Array.isArray(resolutions) || !Array.isArray(votes) || !Array.isArray(coproprietaires)) {
      return res.status(400).json({
        error: "resolutions, votes et coproprietaires (tableaux) sont requis.",
      });
    }

    const buffer = await generatePVBuffer({ resolutions, votes, coproprietaires });

    const filename = `PV_AG_${new Date().toISOString().slice(0, 10)}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
