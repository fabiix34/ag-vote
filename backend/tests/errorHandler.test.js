import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "../middleware/errorHandler.js";

const mockRes = () => {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("errorHandler", () => {
  it("retourne le statut et le message de l'erreur", () => {
    const err = { status: 404, message: "Non trouvé." };
    const res = mockRes();

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Non trouvé." });
  });

  it("utilise statusCode si status est absent", () => {
    const err = { statusCode: 403, message: "Interdit." };
    const res = mockRes();

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("fallback à 500 si aucun statut défini", () => {
    const err = new Error("Crash inattendu");
    const res = mockRes();

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Crash inattendu" });
  });

  it("fallback au message par défaut si message absent", () => {
    const err = { status: 500 };
    const res = mockRes();

    errorHandler(err, {}, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ error: "Erreur interne du serveur." });
  });
});
