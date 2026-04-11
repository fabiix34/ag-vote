import { useState } from "react";
import { FilePen, Plus, Trash2, X, Clock, Archive, AwardIcon } from "lucide-react";
import { api } from "../../lib/api";
import { pouvoirService } from "../../lib/services/pouvoir.service";
import { auditLogService } from "../../lib/services/auditLog.service";
import { formatTantiemes } from "../../hooks/formatTantieme";
import { AlertModal } from "../../components/AlertModal";

const VOTE_BUTTONS = [
  {
    choix: "pour",
    label: "Pour",
    active: "bg-emerald-600 text-white ring-2 ring-emerald-400/60",
    idle: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/40",
  },
  {
    choix: "contre",
    label: "Contre",
    active: "bg-red-600 text-white ring-2 ring-red-400/60",
    idle: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40",
  },
  {
    choix: "abstention",
    label: "Abst.",
    active: "bg-zinc-600 text-white ring-2 ring-zinc-400/60",
    idle: "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600",
  },
  {
    choix: null,
    label: "Libre",
    active: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-2 ring-blue-300/60",
    idle: "bg-white dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700",
  },
];

export function PouvoirsTab({ pouvoirs, coproprietaires, resolutions, agSessionId, canAdd = true, isReadOnly = false, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [mandantId, setMandantId] = useState("");
  const [mandataireId, setMandataireId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [instructionsModal, setInstructionsModal] = useState(null); // pouvoir object or null
  const [editingVotes, setEditingVotes] = useState({}); // { pouvoirId: { resolutionId: choix } }
  const [savingVotes, setSavingVotes] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [alertModal, setAlertModal] = useState(null);
  const closeModal = () => setAlertModal(null);

  // Copros qui n'ont pas encore donné de pouvoir dans cette AG
  const mandantsDisponibles = coproprietaires.filter(
    (c) => !c.presence && !pouvoirs.find((p) => p.mandant_id === c.id)
  );

  const copro = (id) => coproprietaires.find((c) => c.id === id);

  const handleOpenModal = () => {
    setMandantId("");
    setMandataireId("");
    setError(null);
    setShowModal(true);
  };

  const handleAddPouvoir = async (e) => {
    e.preventDefault();
    if (!mandantId || !mandataireId) {
      setError("Veuillez sélectionner le mandant et le mandataire.");
      return;
    }
    if (mandantId === mandataireId) {
      setError("Le mandant et le mandataire doivent être différents.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: err } = await pouvoirService.createWithChain({ mandantId, mandataireId, agSessionId });
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      const mandant = copro(mandantId);
      const mandataire = copro(mandataireId);
      await auditLogService.logPouvoirCreatedSyndic({
        agSessionId, mandantId, details: {
          pouvoir_id: data?.id ?? null,
          mandataire_id: mandataireId,
          mandant_prenom: mandant?.prenom,
          mandant_nom: mandant?.nom,
          mandataire_prenom: mandataire?.prenom,
          mandataire_nom: mandataire?.nom,
        }
      });
      setShowModal(false);
      onUpdate();
    }
  };

  const handleDelete = (pouvoir) => {
    const mandant = copro(pouvoir.mandant_id);
    const mandataire = copro(pouvoir.mandataire_id);
    setAlertModal({
      title: "Supprimer ce pouvoir ?",
      message: "Cette action est enregistrée dans l'audit trail.",
      type: "confirm",
      buttons: [
        { label: "Annuler", variant: "secondary", onClick: closeModal },
        {
          label: "Confirmer", variant: "danger", onClick: async () => {
            closeModal();
            setDeletingId(pouvoir.id);
            await Promise.all([
              pouvoirService.softDelete(pouvoir.id),
              auditLogService.logPouvoirDeletedSyndic({
                agSessionId, mandantId: pouvoir.mandant_id, details: {
                  pouvoir_id: pouvoir.id,
                  mandataire_id: pouvoir.mandataire_id,
                  mandant_prenom: mandant?.prenom,
                  mandant_nom: mandant?.nom,
                  mandataire_prenom: mandataire?.prenom,
                  mandataire_nom: mandataire?.nom,
                }
              }),
            ]);
            setDeletingId(null);
            onUpdate();
          }
        },
      ],
    });
  };

  const statutBadge = (p) => {
    if (p.statut === "scheduled_stop")
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
          <Clock size={9} /> Fin prochaine résolution
        </span>
      );
    if (p.statut === "archived" || p.statut === "cancelled")
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
          <Archive size={9} /> {p.statut === "cancelled" ? "Annulé" : "Archivé"}
        </span>
      );
    if (p.statut === "pending_activation" || (p.statut === "active" && p.start_resolution_id))
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
          <Clock size={9} /> En attente
        </span>
      );
    return null;
  };

  const handleOpenInstructions = (pouvoir) => {
    setInstructionsModal(pouvoir);
    setEditingVotes((prev) => ({ ...prev, [pouvoir.id]: { ...(pouvoir.votes_imposes || {}) } }));
  };

  const handleCloseInstructions = () => {
    setInstructionsModal(null);
  };

  const handleVoteImpose = (pouvoirId, resolutionId, choix) => {
    setEditingVotes((prev) => {
      const current = { ...(prev[pouvoirId] || {}) };
      if (choix === null || choix === "") {
        delete current[resolutionId];
      } else {
        current[resolutionId] = choix;
      }
      return { ...prev, [pouvoirId]: current };
    });
  };

  const handleSaveVotesImposes = async (pouvoirId) => {
    setSavingVotes(pouvoirId);
    const pouvoir = pouvoirs.find((p) => p.id === pouvoirId);
    const newVotesImposes = editingVotes[pouvoirId] || {};

    const mandant = copro(pouvoir.mandant_id);

    const ops = [
      api.patch(`/pouvoirs/${pouvoirId}/votes-imposes`, { votesImposes: newVotesImposes }),
    ];

    for (const [resolutionId, choix] of Object.entries(newVotesImposes)) {
      if (choix && mandant) {
        ops.push(api.post("/votes/upsert", { coproId: mandant.id, resolutionId, choix, tantiemes: mandant.tantiemes }));
      }
    }

    await Promise.all(ops);
    setSavingVotes(null);
    setInstructionsModal(null);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      <AlertModal
        isOpen={!!alertModal}
        onClose={closeModal}
        title={alertModal?.title ?? ""}
        message={alertModal?.message}
        type={alertModal?.type}
        buttons={alertModal?.buttons ?? []}
        input={alertModal?.input ?? null}
      />

      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Pouvoirs de vote ({pouvoirs.length})
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {!canAdd
                ? "L'AG est terminée — aucun pouvoir ne peut plus être enregistré."
                : isReadOnly
                  ? "Séance en cours — vous pouvez encore enregistrer un pouvoir."
                  : "Délégations enregistrées pour cette AG"}
            </p>
          </div>
          {canAdd && (
            <button
              onClick={handleOpenModal}
              className="flex items-center gap-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} />
              Enregistrer un pouvoir
            </button>
          )}
        </div>

        {pouvoirs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-zinc-400 text-sm">Aucun pouvoir enregistré pour cette AG.</p>
            <p className="text-zinc-500 text-xs mt-1">
              Enregistrez les délégations des copropriétaires absents.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {pouvoirs.map((p) => {
              const mandant = copro(p.mandant_id);
              const mandataire = copro(p.mandataire_id);
              const nbImposes = Object.keys(p.votes_imposes || {}).length;

              return (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  {/* Mandant */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Mandant</span>
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        {mandant ? `${mandant.prenom} ${mandant.nom}` : "—"}
                      </span>
                      {mandant && (
                        <span className="text-xs text-zinc-400 font-mono">
                          {formatTantiemes(mandant.tantiemes)} tants.
                        </span>
                      )}
                      {statutBadge(p)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-400">donne pouvoir à</span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {mandataire ? `${mandataire.prenom} ${mandataire.nom}` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {nbImposes > 0 && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                        {nbImposes} instruction{nbImposes > 1 ? "s" : ""}
                      </span>
                    )}
                    {canAdd && (
                      <button
                        onClick={() => handleOpenInstructions(p)}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Instructions de vote"
                      >
                        <FilePen size={12} />
                      </button>
                    )}
                    {canAdd && (
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40 p-1"
                        title="Supprimer ce pouvoir"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal instructions de vote */}
      {instructionsModal && (() => {
        const mandant = copro(instructionsModal.mandant_id);
        const mandataire = copro(instructionsModal.mandataire_id);
        return (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={handleCloseInstructions}
          >
            <div
              className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white">Instructions de vote</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {mandant ? `${mandant.prenom} ${mandant.nom}` : "—"}
                    </span>
                    {" "}→{" "}
                    {mandataire ? `${mandataire.prenom} ${mandataire.nom}` : "—"}
                  </p>
                </div>
                <button onClick={handleCloseInstructions} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
                <p className="text-xs text-zinc-500">
                  Indiquez le souhait du mandant par résolution. Sans instruction, le mandataire vote librement.
                </p>
                {resolutions.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Aucune résolution à l'ordre du jour.</p>
                ) : (
                  resolutions.map((r) => {
                    const imposed = editingVotes[instructionsModal.id]?.[r.id] ?? null;
                    return (
                      <div key={r.id} className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 leading-tight flex-1 min-w-0">
                            {r.titre}
                          </p>
                          {r.statut === "en_cours" && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">
                              En cours
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {VOTE_BUTTONS.map(({ choix, label, active, idle }) => {
                            const isSelected = imposed === choix;
                            return (
                              <button
                                key={choix ?? "libre"}
                                onClick={() => handleVoteImpose(instructionsModal.id, r.id, choix)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${isSelected ? active : idle}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        {imposed && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            Le mandataire votera{" "}
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                              {imposed.toUpperCase()}
                            </span>{" "}
                            pour cette résolution.
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0">
                <button
                  onClick={handleCloseInstructions}
                  className="text-sm px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => handleSaveVotesImposes(instructionsModal.id)}
                  disabled={savingVotes === instructionsModal.id}
                  className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {savingVotes === instructionsModal.id ? "Enregistrement..." : "Enregistrer les instructions"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal ajout pouvoir */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-zinc-900 dark:text-white">Enregistrer un pouvoir</h3>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPouvoir} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Mandant <span className="text-red-500">*</span>
                  <span className="font-normal text-zinc-400 ml-1">(copropriétaire absent qui donne son pouvoir)</span>
                </label>
                <select
                  value={mandantId}
                  onChange={(e) => setMandantId(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Sélectionner le mandant —</option>
                  {mandantsDisponibles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom} {c.nom} ({formatTantiemes(c.tantiemes)} tants.)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Mandataire <span className="text-red-500">*</span>
                  <span className="font-normal text-zinc-400 ml-1">(copropriétaire présent qui reçoit le pouvoir)</span>
                </label>
                <select
                  value={mandataireId}
                  onChange={(e) => setMandataireId(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">— Sélectionner le mandataire —</option>
                  {coproprietaires
                    .filter((c) => c.id !== mandantId && c.presence)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.prenom} {c.nom}
                      </option>
                    ))}
                </select>
              </div>

              <p className="text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                Les votes spécifiques du mandant pourront être configurés après l'enregistrement.
              </p>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
