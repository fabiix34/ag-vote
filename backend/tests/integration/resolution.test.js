import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../config.js", () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
  config: { port: 3001, corsOrigin: "*" },
}));

vi.mock("../../services/db.service.js", () => ({
  resolutionService: {
    fetchByAgSession: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatut: vi.fn(),
    pauseOthers: vi.fn(),
    closeAllActive: vi.fn(),
    delete: vi.fn(),
  },
}));

import { supabaseAnon, supabaseAdmin } from "../../config.js";
import { resolutionService } from "../../services/db.service.js";
import { createApp } from "./helpers/app.js";

const app = createApp();

const withSyndicAuth = (req) => req.set("Authorization", "Bearer valid_token");

// Simule un copropriétaire via X-Copro-Id
const withCoproAuth = (req) => {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: { id: "copro-1" }, error: null });
  supabaseAdmin.from.mockReturnValue(chain);
  return req.set("x-copro-id", "copro-1");
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAnon.auth.getUser.mockResolvedValue({
    data: { user: { id: "syndic-uuid" } },
    error: null,
  });
});

// ── GET /api/resolutions ──────────────────────────────────────────────────────

describe("GET /api/resolutions", () => {
  it("retourne 401 sans authentification", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await request(app).get("/api/resolutions");
    expect(res.status).toBe(401);
  });

  it("retourne 400 si agSessionId est manquant", async () => {
    const res = await withSyndicAuth(request(app).get("/api/resolutions"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/agSessionId est requis/);
  });

  it("retourne la liste des résolutions pour un syndic", async () => {
    resolutionService.fetchByAgSession.mockResolvedValue({
      data: [{ id: "r1", titre: "Vote budget" }],
      error: null,
    });

    const res = await withSyndicAuth(
      request(app).get("/api/resolutions?agSessionId=ag-1")
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(resolutionService.fetchByAgSession).toHaveBeenCalledWith("ag-1");
  });

  it("accepte un copropriétaire authentifié via X-Copro-Id", async () => {
    resolutionService.fetchByAgSession.mockResolvedValue({ data: [], error: null });

    const res = await withCoproAuth(
      request(app).get("/api/resolutions?agSessionId=ag-1")
    );

    expect(res.status).toBe(200);
  });
});

// ── POST /api/resolutions ─────────────────────────────────────────────────────

describe("POST /api/resolutions", () => {
  it("retourne 401 pour un copropriétaire (route syndic uniquement)", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await withCoproAuth(request(app).post("/api/resolutions").send({}));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si agSessionId est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).post("/api/resolutions").send({ titre: "Budget" })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/agSessionId est requis/);
  });

  it("retourne 201 avec la résolution créée", async () => {
    resolutionService.create.mockResolvedValue({
      data: { id: "r1" },
      error: null,
    });

    const res = await withSyndicAuth(
      request(app).post("/api/resolutions").send({
        agSessionId: "ag-1",
        titre: "Budget annuel",
        majority_rule: "ARTICLE_24",
      })
    );

    expect(res.status).toBe(201);
    expect(resolutionService.create).toHaveBeenCalledWith("ag-1", {
      titre: "Budget annuel",
      majority_rule: "ARTICLE_24",
    });
  });
});

// ── PATCH /api/resolutions/:id/statut ────────────────────────────────────────

describe("PATCH /api/resolutions/:id/statut", () => {
  it("retourne 400 si statut est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).patch("/api/resolutions/r1/statut").send({})
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/statut est requis/);
  });

  it("retourne 200 si le statut est mis à jour", async () => {
    resolutionService.updateStatut.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).patch("/api/resolutions/r1/statut").send({ statut: "en_cours" })
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(resolutionService.updateStatut).toHaveBeenCalledWith("r1", "en_cours");
  });
});

// ── POST /api/resolutions/pause-others ───────────────────────────────────────

describe("POST /api/resolutions/pause-others", () => {
  it("retourne 401 sans token syndic", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await request(app).post("/api/resolutions/pause-others");
    expect(res.status).toBe(401);
  });

  it("retourne 200 et met en pause les résolutions en cours", async () => {
    resolutionService.pauseOthers.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).post("/api/resolutions/pause-others")
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(resolutionService.pauseOthers).toHaveBeenCalledOnce();
  });
});

// ── POST /api/resolutions/close-all ──────────────────────────────────────────

describe("POST /api/resolutions/close-all", () => {
  it("retourne 400 si agSessionId est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).post("/api/resolutions/close-all").send({})
    );
    expect(res.status).toBe(400);
  });

  it("retourne 200 et ferme toutes les résolutions actives", async () => {
    resolutionService.closeAllActive.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).post("/api/resolutions/close-all").send({ agSessionId: "ag-1" })
    );

    expect(res.status).toBe(200);
    expect(resolutionService.closeAllActive).toHaveBeenCalledWith("ag-1");
  });
});

// ── DELETE /api/resolutions/:id ───────────────────────────────────────────────

describe("DELETE /api/resolutions/:id", () => {
  it("retourne 401 sans token syndic", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await request(app).delete("/api/resolutions/r1");
    expect(res.status).toBe(401);
  });

  it("retourne 200 si la résolution est supprimée", async () => {
    resolutionService.delete.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(request(app).delete("/api/resolutions/r1"));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(resolutionService.delete).toHaveBeenCalledWith("r1");
  });
});
