import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../config.js", () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
  config: { port: 3001, corsOrigin: "*" },
}));

vi.mock("../../services/db.service.js", () => ({
  coproprieteService: {
    fetchBySyndic: vi.fn(),
    fetchById: vi.fn(),
    create: vi.fn(),
    updateNom: vi.fn(),
  },
}));

import { supabaseAnon } from "../../config.js";
import { coproprieteService } from "../../services/db.service.js";
import { createApp } from "./helpers/app.js";

const app = createApp();

// Simule un syndic authentifié
const withSyndicAuth = (req) =>
  req.set("Authorization", "Bearer valid_token");

beforeEach(() => {
  vi.clearAllMocks();
  // Par défaut, le token est valide
  supabaseAnon.auth.getUser.mockResolvedValue({
    data: { user: { id: "syndic-uuid" } },
    error: null,
  });
});

// ── GET /api/coproprietes ─────────────────────────────────────────────────────

describe("GET /api/coproprietes", () => {
  it("retourne 401 sans token", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await request(app).get("/api/coproprietes");
    expect(res.status).toBe(401);
  });

  it("retourne la liste des copropriétés", async () => {
    coproprieteService.fetchBySyndic.mockResolvedValue({
      data: [{ id: "c1", nom: "Résidence A" }],
      error: null,
    });

    const res = await withSyndicAuth(request(app).get("/api/coproprietes"));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nom).toBe("Résidence A");
  });

  it("retourne 500 si la base de données échoue", async () => {
    coproprieteService.fetchBySyndic.mockResolvedValue({
      data: null,
      error: { message: "DB error" },
    });

    const res = await withSyndicAuth(request(app).get("/api/coproprietes"));
    expect(res.status).toBe(500);
  });
});

// ── GET /api/coproprietes/:id ─────────────────────────────────────────────────

describe("GET /api/coproprietes/:id", () => {
  it("retourne la copropriété si elle existe", async () => {
    coproprieteService.fetchById.mockResolvedValue({
      data: { id: "c1", nom: "Résidence A" },
      error: null,
    });

    const res = await withSyndicAuth(request(app).get("/api/coproprietes/c1"));

    expect(res.status).toBe(200);
    expect(res.body.nom).toBe("Résidence A");
  });

  it("retourne 404 si la copropriété n'existe pas", async () => {
    coproprieteService.fetchById.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const res = await withSyndicAuth(request(app).get("/api/coproprietes/unknown"));
    expect(res.status).toBe(404);
  });
});

// ── POST /api/coproprietes ────────────────────────────────────────────────────

describe("POST /api/coproprietes", () => {
  it("retourne 400 si nom est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).post("/api/coproprietes").send({ adresse: "1 rue de Paris" })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nom est requis/);
  });

  it("retourne 201 avec la copropriété créée", async () => {
    coproprieteService.create.mockResolvedValue({
      data: { id: "c2", nom: "Résidence B", adresse: "1 rue de Paris" },
      error: null,
    });

    const res = await withSyndicAuth(
      request(app)
        .post("/api/coproprietes")
        .send({ nom: "Résidence B", adresse: "1 rue de Paris" })
    );

    expect(res.status).toBe(201);
    expect(res.body.nom).toBe("Résidence B");
    expect(coproprieteService.create).toHaveBeenCalledWith(
      "syndic-uuid",
      "Résidence B",
      "1 rue de Paris"
    );
  });

  it("utilise req.syndicId comme propriétaire de la copropriété", async () => {
    coproprieteService.create.mockResolvedValue({
      data: { id: "c3", nom: "Résidence C" },
      error: null,
    });

    await withSyndicAuth(
      request(app).post("/api/coproprietes").send({ nom: "Résidence C" })
    );

    expect(coproprieteService.create).toHaveBeenCalledWith("syndic-uuid", "Résidence C", undefined);
  });
});

// ── PATCH /api/coproprietes/:id/nom ──────────────────────────────────────────

describe("PATCH /api/coproprietes/:id/nom", () => {
  it("retourne 400 si nom est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).patch("/api/coproprietes/c1/nom").send({})
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nom est requis/);
  });

  it("retourne 200 si le nom est mis à jour", async () => {
    coproprieteService.updateNom.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).patch("/api/coproprietes/c1/nom").send({ nom: "Nouveau Nom" })
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(coproprieteService.updateNom).toHaveBeenCalledWith("c1", "Nouveau Nom");
  });
});
