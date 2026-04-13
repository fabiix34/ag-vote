import { describe, it, expect } from "vitest";
import { evaluateResolutionVotes } from "../utils/voteMajorityCalculator.js";

// Helpers
const resolution = (id, majority_rule) => ({ id, majority_rule });

const vote = (resolution_id, choix, tantiemes_poids) => ({
  resolution_id,
  choix,
  tantiemes_poids,
});

const copro = (tantiemes) => ({ tantiemes });

// 4 copros, 1000 tantièmes au total (250 chacun)
const copros4x250 = [copro(250), copro(250), copro(250), copro(250)];

describe("evaluateResolutionVotes — cas de base", () => {
  it("retourne undetermined si majority_rule est absent", () => {
    const res = evaluateResolutionVotes({ id: 1 }, [], copros4x250);
    expect(res.undetermined).toBe(true);
    expect(res.passed).toBe(false);
  });

  it("retourne undetermined si majority_rule est inconnu", () => {
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_99"), [], copros4x250);
    expect(res.undetermined).toBe(true);
  });

  it("filtre correctement les votes par resolution_id", () => {
    const votes = [
      vote(1, "pour", 300),
      vote(2, "pour", 500), // autre résolution — ne doit pas compter
    ];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, copros4x250);
    expect(res.votesFor).toBe(300);
  });
});

describe("ARTICLE_24 — Majorité simple", () => {
  it("adopté si tantièmes pour > tantièmes contre", () => {
    const votes = [vote(1, "pour", 600), vote(1, "contre", 400)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, copros4x250);
    expect(res.passed).toBe(true);
    expect(res.fallbackPossible).toBe(false);
    expect(res.undetermined).toBe(false);
  });

  it("rejeté si tantièmes pour < tantièmes contre", () => {
    const votes = [vote(1, "pour", 300), vote(1, "contre", 500)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, copros4x250);
    expect(res.passed).toBe(false);
  });

  it("rejeté si égalité", () => {
    const votes = [vote(1, "pour", 500), vote(1, "contre", 500)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, copros4x250);
    expect(res.passed).toBe(false);
  });

  it("retourne les bons totaux votesFor / votesAgainst", () => {
    const votes = [vote(1, "pour", 400), vote(1, "contre", 200)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, copros4x250);
    expect(res.votesFor).toBe(400);
    expect(res.votesAgainst).toBe(200);
  });
});

describe("ARTICLE_25 — Majorité absolue", () => {
  // Total = 1000 tantièmes → majorité absolue > 500

  it("adopté si pour > 50% des tantièmes totaux", () => {
    const votes = [vote(1, "pour", 501)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_25"), votes, copros4x250);
    expect(res.passed).toBe(true);
    expect(res.fallbackPossible).toBe(false);
  });

  it("rejeté si pour = exactement 50%", () => {
    const votes = [vote(1, "pour", 500)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_25"), votes, copros4x250);
    expect(res.passed).toBe(false);
  });

  it("fallback vers Art. 24 si pour >= 1/3 des tantièmes mais pas majorité absolue", () => {
    // 1/3 de 1000 = 333.33 → >= 334 déclenche fallback
    const votes = [vote(1, "pour", 400), vote(1, "contre", 400)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_25"), votes, copros4x250);
    expect(res.passed).toBe(false);
    expect(res.fallbackPossible).toBe(true);
    expect(res.fallbackArticle).toBe("ARTICLE_24");
  });

  it("pas de fallback si pour < 1/3 des tantièmes", () => {
    const votes = [vote(1, "pour", 300)]; // 300 < 333.33
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_25"), votes, copros4x250);
    expect(res.passed).toBe(false);
    expect(res.fallbackPossible).toBe(false);
  });
});

describe("ARTICLE_26 — Double majorité", () => {
  // 4 copros → majorité > 2 (au moins 3)
  // 1000 tantièmes → 2/3 = 666.67 tantièmes minimum

  it("adopté si majorité des copros ET >= 2/3 des tantièmes", () => {
    // 3 votes pour sur 4 copros, 700 tantièmes
    const votes = [
      vote(1, "pour", 250),
      vote(1, "pour", 250),
      vote(1, "pour", 200),
    ];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_26"), votes, copros4x250);
    expect(res.passed).toBe(true);
    expect(res.fallbackPossible).toBe(false);
  });

  it("rejeté si majorité des copros mais pas 2/3 des tantièmes", () => {
    const votes = [
      vote(1, "pour", 200),
      vote(1, "pour", 200),
      vote(1, "pour", 200),
    ]; // 3 copros sur 4 (ok), mais 600 < 666.67 (ko)
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_26"), votes, copros4x250);
    expect(res.passed).toBe(false);
  });

  it("rejeté si 2/3 des tantièmes mais pas majorité des copros", () => {
    // 2 votes pour sur 4 copros (pas majorité), mais 700 tantièmes
    const votes = [vote(1, "pour", 350), vote(1, "pour", 350)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_26"), votes, copros4x250);
    expect(res.passed).toBe(false);
  });

  it("fallback vers Art. 25 si >= moitié des copros ET >= 1/3 des tantièmes", () => {
    // 2 sur 4 copros (= moitié ok), 400 tantièmes (>= 1/3 ok)
    const votes = [vote(1, "pour", 200), vote(1, "pour", 200)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_26"), votes, copros4x250);
    expect(res.passed).toBe(false);
    expect(res.fallbackPossible).toBe(true);
    expect(res.fallbackArticle).toBe("ARTICLE_25");
  });

  it("pas de fallback si moins de moitié des copros", () => {
    const votes = [vote(1, "pour", 400)]; // 1 copro sur 4 (< moitié)
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_26"), votes, copros4x250);
    expect(res.passed).toBe(false);
    expect(res.fallbackPossible).toBe(false);
  });
});

describe("Votes avec tantièmes_poids nuls ou manquants", () => {
  it("traite tantièmes_poids absent comme 0", () => {
    const votes = [
      { resolution_id: 1, choix: "pour" }, // pas de tantiemes_poids
      vote(1, "contre", 100),
    ];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, copros4x250);
    expect(res.votesFor).toBe(0);
    expect(res.passed).toBe(false);
  });

  it("fonctionne avec une liste de copropriétaires vide", () => {
    const votes = [vote(1, "pour", 300)];
    const res = evaluateResolutionVotes(resolution(1, "ARTICLE_24"), votes, []);
    expect(res.passed).toBe(true); // 300 > 0
  });
});
