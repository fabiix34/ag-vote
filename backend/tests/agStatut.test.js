import { describe, it, expect } from "vitest";
import {
  AG_STATUT,
  isConstruction,
  isVoteAnticipe,
  isLive,
  isTerminee,
  isVotePossible,
} from "../utils/agStatut.js";

describe("AG_STATUT", () => {
  it("contient les 4 statuts attendus", () => {
    expect(AG_STATUT.PLANIFIEE).toBe("planifiee");
    expect(AG_STATUT.VOTE_ANTICIPE).toBe("vote_anticipe");
    expect(AG_STATUT.EN_COURS).toBe("en_cours");
    expect(AG_STATUT.TERMINEE).toBe("terminee");
  });
});

describe("isConstruction", () => {
  it("retourne true pour PLANIFIEE", () => {
    expect(isConstruction("planifiee")).toBe(true);
  });
  it("retourne false pour les autres statuts", () => {
    expect(isConstruction("vote_anticipe")).toBe(false);
    expect(isConstruction("en_cours")).toBe(false);
    expect(isConstruction("terminee")).toBe(false);
    expect(isConstruction(null)).toBe(false);
  });
});

describe("isVoteAnticipe", () => {
  it("retourne true pour VOTE_ANTICIPE", () => {
    expect(isVoteAnticipe("vote_anticipe")).toBe(true);
  });
  it("retourne false pour les autres statuts", () => {
    expect(isVoteAnticipe("planifiee")).toBe(false);
    expect(isVoteAnticipe("en_cours")).toBe(false);
    expect(isVoteAnticipe("terminee")).toBe(false);
  });
});

describe("isLive", () => {
  it("retourne true pour EN_COURS", () => {
    expect(isLive("en_cours")).toBe(true);
  });
  it("retourne false pour les autres statuts", () => {
    expect(isLive("planifiee")).toBe(false);
    expect(isLive("vote_anticipe")).toBe(false);
    expect(isLive("terminee")).toBe(false);
  });
});

describe("isTerminee", () => {
  it("retourne true pour TERMINEE", () => {
    expect(isTerminee("terminee")).toBe(true);
  });
  it("retourne false pour les autres statuts", () => {
    expect(isTerminee("planifiee")).toBe(false);
    expect(isTerminee("vote_anticipe")).toBe(false);
    expect(isTerminee("en_cours")).toBe(false);
  });
});

describe("isVotePossible", () => {
  it("retourne true pour VOTE_ANTICIPE", () => {
    expect(isVotePossible("vote_anticipe")).toBe(true);
  });
  it("retourne true pour EN_COURS", () => {
    expect(isVotePossible("en_cours")).toBe(true);
  });
  it("retourne false pour PLANIFIEE et TERMINEE", () => {
    expect(isVotePossible("planifiee")).toBe(false);
    expect(isVotePossible("terminee")).toBe(false);
    expect(isVotePossible(null)).toBe(false);
  });
});
