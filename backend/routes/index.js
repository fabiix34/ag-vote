import { Router } from "express";
import authRoutes          from "./auth.routes.js";
import syndicRoutes        from "./syndic.routes.js";
import coproprieteRoutes   from "./copropriete.routes.js";
import agRoutes            from "./ag.routes.js";
import coproprietaireRoutes from "./coproprietaire.routes.js";
import resolutionRoutes    from "./resolution.routes.js";
import voteRoutes          from "./vote.routes.js";
import pouvoirRoutes       from "./pouvoir.routes.js";
import pouvoirTokenRoutes  from "./pouvoirToken.routes.js";
import auditLogRoutes      from "./auditLog.routes.js";
import documentRoutes      from "./document.routes.js";
import templateRoutes      from "./template.routes.js";
import pvRoutes            from "./pv.routes.js";

const router = Router();

router.use("/auth",             authRoutes);
router.use("/syndics",          syndicRoutes);
router.use("/coproprietes",     coproprieteRoutes);
router.use("/ag",               agRoutes);
router.use("/coproprietaires",  coproprietaireRoutes);
router.use("/resolutions",      resolutionRoutes);
router.use("/votes",            voteRoutes);
router.use("/pouvoirs",         pouvoirRoutes);
router.use("/pouvoir-tokens",   pouvoirTokenRoutes);
router.use("/audit-logs",       auditLogRoutes);
router.use("/documents",        documentRoutes);
router.use("/templates",        templateRoutes);
router.use("/pv",               pvRoutes);

export default router;
