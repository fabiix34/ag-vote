/**
 * Routes audit logs
 *
 * GET  /api/audit-logs?agSessionId=…              — logs d'une session AG
 * GET  /api/audit-logs/copropriete?ids=…          — logs de plusieurs sessions
 * POST /api/audit-logs/auth                       — connexion/déconnexion copropriétaire
 * POST /api/audit-logs/presence                   — arrivée/départ physique
 * POST /api/audit-logs/quota-violation            — violation de quota art. 22
 * POST /api/audit-logs/pouvoir-donne              — pouvoir donné via QR
 * POST /api/audit-logs/pouvoir-revoque            — pouvoir révoqué
 * POST /api/audit-logs/pouvoir-cancelled-manual   — pouvoir annulé par le syndic
 * POST /api/audit-logs/pouvoir-created-syndic     — pouvoir créé par le syndic
 * POST /api/audit-logs/pouvoir-deleted-syndic     — pouvoir supprimé par le syndic
 */
import { Router } from "express";
import { auditLogsService } from "../services/db.service.js";
import { requireSyndic, requireCopro, requireAuth } from "../middleware/auth.js";
import { AuditEvent } from "../utils/auditEvent.js";

const router = Router();

// ── Lecture ───────────────────────────────────────────────────────────────────

router.get("/", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId } = req.query;
    if (!agSessionId) return res.status(400).json({ error: "agSessionId est requis." });

    const { data, error } = await auditLogsService.fetchByAgSession(agSessionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/copropriete", requireSyndic, async (req, res, next) => {
  try {
    const ids = req.query.ids;
    if (!ids) return res.status(400).json({ error: "ids est requis." });

    const agSessionIds = Array.isArray(ids) ? ids : ids.split(",");
    const { data, error } = await auditLogsService.fetchByCopropriete(agSessionIds);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── Écriture ──────────────────────────────────────────────────────────────────

router.post("/auth", requireCopro, async (req, res, next) => {
  try {
    const { coproId, agSessionId, eventType, metadata } = req.body;
    if (!coproId || !eventType) {
      return res.status(400).json({ error: "coproId et eventType sont requis." });
    }
    const { error } = await auditLogsService.logAuthEvent(
      coproId, agSessionId, eventType, metadata
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/presence", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId, coproId, arrived, details } = req.body;
    if (!coproId || typeof arrived !== "boolean") {
      return res.status(400).json({ error: "coproId et arrived (boolean) sont requis." });
    }
    const { error } = await auditLogsService.logPresenceEvent(
      agSessionId, coproId, arrived, details
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/quota-violation", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId, mandataireId, detail } = req.body;
    const { error } = await auditLogsService.logQuotaViolation(
      agSessionId, mandataireId, detail
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/pouvoir-donne", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId, mandantId, details } = req.body;
    const { error } = await auditLogsService.logPouvoirDonne(agSessionId, mandantId, details);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/pouvoir-revoque", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId, coproId, details } = req.body;
    const { error } = await auditLogsService.logPouvoirRevoque(agSessionId, coproId, details);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/pouvoir-cancelled-manual", requireAuth, async (req, res, next) => {
  try {
    const { agSessionId, mandantId, pouvoirId, mandataireId, tantiemes } = req.body;
    const { error } = await auditLogsService.logPouvoirCancelledManual(
      agSessionId, mandantId, pouvoirId, mandataireId, tantiemes
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/pouvoir-created-syndic", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId, mandantId, details } = req.body;
    const { error } = await auditLogsService.logPouvoirCreatedSyndic(
      agSessionId, mandantId, details
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post("/pouvoir-deleted-syndic", requireSyndic, async (req, res, next) => {
  try {
    const { agSessionId, mandantId, details } = req.body;
    const { error } = await auditLogsService.logPouvoirDeletedSyndic(
      agSessionId, mandantId, details
    );
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
