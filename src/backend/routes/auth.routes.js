/**
 * Routes d'authentification
 *
 * POST /api/auth/syndic/register  — inscription d'un syndic
 * POST /api/auth/syndic/login     — connexion d'un syndic (retourne le token Supabase)
 * POST /api/auth/syndic/logout    — déconnexion
 * POST /api/auth/copro/login      — connexion copropriétaire (email + date_naissance)
 */
import { Router } from "express";
import { supabaseAnon, supabaseAdmin } from "../config.js";
import { syndicService, coproprietaireService, auditLogsService } from "../services/db.service.js";
import { requireSyndic } from "../middleware/auth.js";
import { AuditEvent } from "../utils/auditEvent.js";

const router = Router();

// ── Syndic : inscription ──────────────────────────────────────────────────────
router.post("/syndic/register", async (req, res, next) => {
  try {
    const { email, password, nom, prenom } = req.body;
    if (!email || !password || !nom || !prenom) {
      return res.status(400).json({ error: "email, password, nom et prenom sont requis." });
    }

    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email,
      password,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const userId = authData.user?.id;
    if (!userId) return res.status(500).json({ error: "Impossible de créer l'utilisateur." });

    const { data: syndic, error: dbError } = await syndicService.create(
      userId,
      email,
      nom,
      prenom
    );
    if (dbError) return res.status(500).json({ error: dbError.message });

    res.status(201).json({ syndic, session: authData.session });
  } catch (err) {
    next(err);
  }
});

// ── Syndic : connexion ────────────────────────────────────────────────────────
router.post("/syndic/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email et password sont requis." });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });

    const { data: syndic, error: dbError } = await syndicService.fetch(data.user.id);
    if (dbError) return res.status(404).json({ error: "Profil syndic introuvable." });

    res.json({ syndic, session: data.session });
  } catch (err) {
    next(err);
  }
});

// ── Syndic : déconnexion ──────────────────────────────────────────────────────
router.post("/syndic/logout", requireSyndic, async (req, res, next) => {
  try {
    await supabaseAnon.auth.signOut();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Copropriétaire : connexion ────────────────────────────────────────────────
router.post("/copro/login", async (req, res, next) => {
  try {
    const { email, dateNaissance, agSessionId } = req.body;
    if (!email || !dateNaissance) {
      return res.status(400).json({ error: "email et dateNaissance sont requis." });
    }

    const { data: copro, error } = await coproprietaireService.fetchByLogin(
      email,
      dateNaissance
    );
    if (error || !copro) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    // Marquer la présence
    await supabaseAdmin
      .from("coproprietaires")
      .update({ presence: true })
      .eq("id", copro.id);

    // Log d'audit
    if (agSessionId) {
      await auditLogsService.logAuthEvent(copro.id, agSessionId, AuditEvent.AUTH_LOGIN);
    }

    res.json({ copro: { ...copro, presence: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
