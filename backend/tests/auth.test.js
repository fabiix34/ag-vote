import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock du module config avant l'import des middlewares
vi.mock("../config.js", () => ({
  supabaseAnon: {
    auth: {
      getUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { requireSyndic, requireCopro, requireAuth } from "../middleware/auth.js";
import { supabaseAnon, supabaseAdmin } from "../config.js";

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// Helper pour simuler la chaîne supabaseAdmin.from(...).select(...).eq(...).single()
const mockAdminQuery = (result) => {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  supabaseAdmin.from.mockReturnValue(chain);
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── requireSyndic ────────────────────────────────────────────────────────────

describe("requireSyndic", () => {
  it("retourne 401 si le header Authorization est absent", async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await requireSyndic(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token manquant." });
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 401 si le header ne commence pas par 'Bearer '", async () => {
    const req = { headers: { authorization: "Basic abc123" } };
    const res = mockRes();
    const next = vi.fn();

    await requireSyndic(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 401 si le token est invalide", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error("invalid") });

    const req = { headers: { authorization: "Bearer bad_token" } };
    const res = mockRes();
    const next = vi.fn();

    await requireSyndic(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Token invalide ou expiré." });
    expect(next).not.toHaveBeenCalled();
  });

  it("appelle next() et attache req.user et req.syndicId si le token est valide", async () => {
    const user = { id: "syndic-uuid-1" };
    supabaseAnon.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const req = { headers: { authorization: "Bearer valid_token" } };
    const res = mockRes();
    const next = vi.fn();

    await requireSyndic(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(user);
    expect(req.syndicId).toBe("syndic-uuid-1");
  });
});

// ─── requireCopro ─────────────────────────────────────────────────────────────

describe("requireCopro", () => {
  it("retourne 401 si le header X-Copro-Id est absent", async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await requireCopro(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Identifiant copropriétaire manquant." });
    expect(next).not.toHaveBeenCalled();
  });

  it("retourne 401 si le copropriétaire n'existe pas en base", async () => {
    mockAdminQuery({ data: null, error: new Error("not found") });

    const req = { headers: { "x-copro-id": "unknown-id" } };
    const res = mockRes();
    const next = vi.fn();

    await requireCopro(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Copropriétaire introuvable." });
    expect(next).not.toHaveBeenCalled();
  });

  it("appelle next() et attache req.coproId si le copropriétaire est trouvé", async () => {
    mockAdminQuery({ data: { id: "copro-uuid-1" }, error: null });

    const req = { headers: { "x-copro-id": "copro-uuid-1" } };
    const res = mockRes();
    const next = vi.fn();

    await requireCopro(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.coproId).toBe("copro-uuid-1");
  });
});

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  it("retourne 401 si aucun header n'est fourni", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error("no token") });

    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentification requise." });
    expect(next).not.toHaveBeenCalled();
  });

  it("authentifie via JWT syndic valide", async () => {
    const user = { id: "syndic-uuid-2" };
    supabaseAnon.auth.getUser.mockResolvedValue({ data: { user }, error: null });

    const req = { headers: { authorization: "Bearer valid_token" } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.syndicId).toBe("syndic-uuid-2");
  });

  it("authentifie via X-Copro-Id si JWT absent", async () => {
    mockAdminQuery({ data: { id: "copro-uuid-2" }, error: null });

    const req = { headers: { "x-copro-id": "copro-uuid-2" } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.coproId).toBe("copro-uuid-2");
  });

  it("authentifie via X-Copro-Id si JWT invalide", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error("invalid") });
    mockAdminQuery({ data: { id: "copro-uuid-3" }, error: null });

    const req = {
      headers: {
        authorization: "Bearer bad_token",
        "x-copro-id": "copro-uuid-3",
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.coproId).toBe("copro-uuid-3");
  });

  it("retourne 401 si JWT invalide et copropriétaire introuvable", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error("invalid") });
    mockAdminQuery({ data: null, error: new Error("not found") });

    const req = {
      headers: {
        authorization: "Bearer bad_token",
        "x-copro-id": "unknown-copro",
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
