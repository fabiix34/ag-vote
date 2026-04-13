import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../config.js", () => ({
  supabaseAnon: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  config: { port: 3001, corsOrigin: "*" },
}));

vi.mock("../../services/db.service.js", () => ({
  syndicService: {
    fetch: vi.fn(),
    create: vi.fn(),
  },
  coproprietaireService: {
    fetchByLogin: vi.fn(),
  },
  auditLogsService: {
    logAuthEvent: vi.fn(),
  },
}));

import { supabaseAnon, supabaseAdmin } from "../../config.js";
import { syndicService, coproprietaireService, auditLogsService } from "../../services/db.service.js";
import { createApp } from "./helpers/app.js";

const app = createApp();

// Helper pour mocker la chaîne supabaseAdmin.from(...).update(...).eq(...)
const mockAdminChain = () => {
  const chain = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() };
  chain.update.mockReturnValue(chain);
  chain.eq.mockResolvedValue({ error: null });
  supabaseAdmin.from.mockReturnValue(chain);
  return chain;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST /api/auth/syndic/register ────────────────────────────────────────────

describe("POST /api/auth/syndic/register", () => {
  it("retourne 400 si des champs sont manquants", async () => {
    const res = await request(app)
      .post("/api/auth/syndic/register")
      .send({ email: "test@example.com" }); // password, nom, prenom manquants

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requis/);
  });

  it("retourne 400 si Supabase Auth échoue", async () => {
    supabaseAnon.auth.signUp.mockResolvedValue({
      data: {},
      error: { message: "Email déjà utilisé." },
    });

    const res = await request(app).post("/api/auth/syndic/register").send({
      email: "test@example.com",
      password: "secret",
      nom: "Dupont",
      prenom: "Jean",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email déjà utilisé.");
  });

  it("retourne 201 et le syndic créé", async () => {
    supabaseAnon.auth.signUp.mockResolvedValue({
      data: { user: { id: "uid-1" }, session: { token: "sess" } },
      error: null,
    });
    syndicService.create.mockResolvedValue({
      data: { id: "uid-1", email: "test@example.com", nom: "Dupont", prenom: "Jean" },
      error: null,
    });

    const res = await request(app).post("/api/auth/syndic/register").send({
      email: "test@example.com",
      password: "secret",
      nom: "Dupont",
      prenom: "Jean",
    });

    expect(res.status).toBe(201);
    expect(res.body.syndic.nom).toBe("Dupont");
  });
});

// ── POST /api/auth/syndic/login ───────────────────────────────────────────────

describe("POST /api/auth/syndic/login", () => {
  it("retourne 400 si email ou password manquant", async () => {
    const res = await request(app)
      .post("/api/auth/syndic/login")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requis/);
  });

  it("retourne 401 si les identifiants sont incorrects", async () => {
    supabaseAnon.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    const res = await request(app)
      .post("/api/auth/syndic/login")
      .send({ email: "test@example.com", password: "wrong" });

    expect(res.status).toBe(401);
  });

  it("retourne 200 avec syndic et session si connexion réussie", async () => {
    supabaseAnon.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "uid-1" },
        session: { access_token: "tok" },
      },
      error: null,
    });
    syndicService.fetch.mockResolvedValue({
      data: { id: "uid-1", nom: "Dupont" },
      error: null,
    });

    const res = await request(app)
      .post("/api/auth/syndic/login")
      .send({ email: "test@example.com", password: "correct" });

    expect(res.status).toBe(200);
    expect(res.body.syndic.nom).toBe("Dupont");
    expect(res.body.session.access_token).toBe("tok");
  });
});

// ── POST /api/auth/syndic/logout ──────────────────────────────────────────────

describe("POST /api/auth/syndic/logout", () => {
  it("retourne 401 sans token Bearer", async () => {
    const res = await request(app).post("/api/auth/syndic/logout");
    expect(res.status).toBe(401);
  });

  it("retourne 200 si le token est valide", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({
      data: { user: { id: "uid-1" } },
      error: null,
    });
    supabaseAnon.auth.signOut.mockResolvedValue({});

    const res = await request(app)
      .post("/api/auth/syndic/logout")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /api/auth/copro/login ────────────────────────────────────────────────

describe("POST /api/auth/copro/login", () => {
  it("retourne 400 si email ou dateNaissance manquant", async () => {
    const res = await request(app)
      .post("/api/auth/copro/login")
      .send({ email: "copro@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/requis/);
  });

  it("retourne 401 si le copropriétaire n'existe pas", async () => {
    coproprietaireService.fetchByLogin.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const res = await request(app)
      .post("/api/auth/copro/login")
      .send({ email: "copro@example.com", dateNaissance: "1990-01-01" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Identifiants incorrects/);
  });

  it("retourne 200 avec le profil copropriétaire si connexion réussie", async () => {
    coproprietaireService.fetchByLogin.mockResolvedValue({
      data: { id: "copro-1", nom: "Martin", email: "copro@example.com", presence: false },
      error: null,
    });
    mockAdminChain();

    const res = await request(app).post("/api/auth/copro/login").send({
      email: "copro@example.com",
      dateNaissance: "1990-01-01",
    });

    expect(res.status).toBe(200);
    expect(res.body.copro.nom).toBe("Martin");
    expect(res.body.copro.presence).toBe(true);
  });

  it("log un événement d'audit si agSessionId est fourni", async () => {
    coproprietaireService.fetchByLogin.mockResolvedValue({
      data: { id: "copro-1", nom: "Martin", email: "copro@example.com", presence: false },
      error: null,
    });
    mockAdminChain();
    auditLogsService.logAuthEvent.mockResolvedValue({ error: null });

    await request(app).post("/api/auth/copro/login").send({
      email: "copro@example.com",
      dateNaissance: "1990-01-01",
      agSessionId: "ag-123",
    });

    expect(auditLogsService.logAuthEvent).toHaveBeenCalledWith(
      "copro-1",
      "ag-123",
      expect.any(String)
    );
  });
});
