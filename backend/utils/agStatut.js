export const AG_STATUT = {
  PLANIFIEE:     "planifiee",
  VOTE_ANTICIPE: "vote_anticipe",
  EN_COURS:      "en_cours",
  TERMINEE:      "terminee",
};

export const isConstruction  = (s) => s === AG_STATUT.PLANIFIEE;
export const isVoteAnticipe  = (s) => s === AG_STATUT.VOTE_ANTICIPE;
export const isLive          = (s) => s === AG_STATUT.EN_COURS;
export const isTerminee      = (s) => s === AG_STATUT.TERMINEE;
export const isVotePossible  = (s) =>
  s === AG_STATUT.VOTE_ANTICIPE || s === AG_STATUT.EN_COURS;
