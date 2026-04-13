import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../config.js", () => ({
  supabaseAnon: { auth: { getUser: vi.fn() } },
  supabaseAdmin: { from: vi.fn() },
  config: { port: 3001, corsOrigin: "*" },
}));

vi.mock("../../services/db.service.js", () => ({
  agSessionService: {
    fetchByCopropriete: vi.fn(),
    fetchWithCopropriete: vi.fn(),
    fetchActive: vi.fn(),
    create: vi.fn(),
    updateStatut: vi.fn(),
    activateVoteAnticipe: vi.fn(),
    deactivateVoteAnticipe: vi.fn(),
    terminate: vi.fn(),
  },
  resolutionService: {
    closeAllActive: vi.fn(),
  },
  coproprietaireService: {
    resetAllPresence: vi.fn(),
  },
}));

import { supabaseAnon, supabaseAdmin } from "../../config.js";
import { agSessionService, resolutionService, coproprietaireService } from "../../services/db.service.js";
import { createApp } from "./helpers/app.js";

const app = createApp();

const withSyndicAuth = (req) => req.set("Authorization", "Bearer valid_token");

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

// ── GET /api/ag ───────────────────────────────────────────────────────────────

describe("GET /api/ag", () => {
  it("retourne 401 sans authentification", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await request(app).get("/api/ag");
    expect(res.status).toBe(401);
  });

  it("retourne 400 si coproprieteId est manquant", async () => {
    const res = await withSyndicAuth(request(app).get("/api/ag"));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coproprieteId est requis/);
  });

  it("retourne la liste des sessions AG", async () => {
    agSessionService.fetchByCopropriete.mockResolvedValue({
      data: [{ id: "ag-1", statut: "planifiee" }],
      error: null,
    });

    const res = await withSyndicAuth(
      request(app).get("/api/ag?coproprieteId=copro-1")
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(agSessionService.fetchByCopropriete).toHaveBeenCalledWith("copro-1");
  });

  it("accepte un copropriétaire authentifié", async () => {
    agSessionService.fetchByCopropriete.mockResolvedValue({ data: [], error: null });

    const res = await withCoproAuth(
      request(app).get("/api/ag?coproprieteId=copro-1")
    );

    expect(res.status).toBe(200);
  });
});

// ── GET /api/ag/:id ───────────────────────────────────────────────────────────

describe("GET /api/ag/:id", () => {
  it("retourne la session avec la copropriété", async () => {
    agSessionService.fetchWithCopropriete.mockResolvedValue({
      data: { id: "ag-1", coproprietes: { nom: "Résidence A" } },
      error: null,
    });

    const res = await withSyndicAuth(request(app).get("/api/ag/ag-1"));

    expect(res.status).toBe(200);
    expect(res.body.coproprietes.nom).toBe("Résidence A");
  });

  it("retourne 404 si la session n'existe pas", async () => {
    agSessionService.fetchWithCopropriete.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const res = await withSyndicAuth(request(app).get("/api/ag/unknown"));
    expect(res.status).toBe(404);
  });
});

// ── POST /api/ag ──────────────────────────────────────────────────────────────

describe("POST /api/ag", () => {
  it("retourne 401 pour un copropriétaire (route syndic uniquement)", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await withCoproAuth(request(app).post("/api/ag").send({}));
    expect(res.status).toBe(401);
  });

  it("retourne 400 si coproprieteId est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).post("/api/ag").send({ dateAg: "2026-06-15" })
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/coproprieteId est requis/);
  });

  it("retourne 201 avec la session créée", async () => {
    agSessionService.create.mockResolvedValue({
      data: { id: "ag-2", statut: "planifiee", copropriete_id: "copro-1" },
      error: null,
    });

    const res = await withSyndicAuth(
      request(app).post("/api/ag").send({ coproprieteId: "copro-1", dateAg: "2026-06-15" })
    );

    expect(res.status).toBe(201);
    expect(res.body.statut).toBe("planifiee");
    expect(agSessionService.create).toHaveBeenCalledWith("copro-1", "2026-06-15");
  });
});

// ── PATCH /api/ag/:id/statut ──────────────────────────────────────────────────

describe("PATCH /api/ag/:id/statut", () => {
  it("retourne 400 si statut est manquant", async () => {
    const res = await withSyndicAuth(
      request(app).patch("/api/ag/ag-1/statut").send({})
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/statut est requis/);
  });

  it("retourne 200 si le statut est mis à jour", async () => {
    agSessionService.updateStatut.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).patch("/api/ag/ag-1/statut").send({ statut: "en_cours" })
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(agSessionService.updateStatut).toHaveBeenCalledWith("ag-1", "en_cours");
  });
});

// ── PATCH /api/ag/:id/vote-anticipe ──────────────────────────────────────────

describe("PATCH /api/ag/:id/vote-anticipe", () => {
  it("active le vote anticipé si activer=true", async () => {
    agSessionService.activateVoteAnticipe.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).patch("/api/ag/ag-1/vote-anticipe").send({ activer: true })
    );

    expect(res.status).toBe(200);
    expect(agSessionService.activateVoteAnticipe).toHaveBeenCalledWith("ag-1");
    expect(agSessionService.deactivateVoteAnticipe).not.toHaveBeenCalled();
  });

  it("désactive le vote anticipé si activer=false", async () => {
    agSessionService.deactivateVoteAnticipe.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).patch("/api/ag/ag-1/vote-anticipe").send({ activer: false })
    );

    expect(res.status).toBe(200);
    expect(agSessionService.deactivateVoteAnticipe).toHaveBeenCalledWith("ag-1");
    expect(agSessionService.activateVoteAnticipe).not.toHaveBeenCalled();
  });
});

// ── POST /api/ag/:id/terminate ────────────────────────────────────────────────

describe("POST /api/ag/:id/terminate", () => {
  it("retourne 401 sans token syndic", async () => {
    supabaseAnon.auth.getUser.mockResolvedValue({ data: null, error: new Error() });
    const res = await request(app).post("/api/ag/ag-1/terminate");
    expect(res.status).toBe(401);
  });

  it("termine l'AG, ferme les résolutions et remet les présences à 0", async () => {
    agSessionService.terminate.mockResolvedValue({ error: null });
    resolutionService.closeAllActive.mockResolvedValue({ error: null });
    coproprietaireService.resetAllPresence.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app)
        .post("/api/ag/ag-1/terminate")
        .send({ coproprieteId: "copro-1" })
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(agSessionService.terminate).toHaveBeenCalledWith("ag-1");
    expect(resolutionService.closeAllActive).toHaveBeenCalledWith("ag-1");
    expect(coproprietaireService.resetAllPresence).toHaveBeenCalledWith("copro-1");
  });

  it("termine l'AG sans réinitialiser les présences si coproprieteId absent", async () => {
    agSessionService.terminate.mockResolvedValue({ error: null });
    resolutionService.closeAllActive.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).post("/api/ag/ag-1/terminate").send({})
    );

    expect(res.status).toBe(200);
    expect(coproprietaireService.resetAllPresence).not.toHaveBeenCalled();
  });

  it("retourne 500 si une opération échoue", async () => {
    agSessionService.terminate.mockResolvedValue({ error: { message: "DB error" } });
    resolutionService.closeAllActive.mockResolvedValue({ error: null });

    const res = await withSyndicAuth(
      request(app).post("/api/ag/ag-1/terminate").send({})
    );

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("DB error");
  });
});
