import { useState } from "react";
import { ChevronDown, ChevronUp, FilePen, Plus, Trash2, X, Clock, Archive } from "lucide-react";
import { pouvoirService, voteService } from "../../services/db";
import { formatTantiemes } from "../../hooks/formatTantieme";
import { AlertModal } from "../../components/AlertModal";

const CHOIX_OPTS = [
  { value: "", label: "— Laisse décider le mandataire —" },
  { value: "pour", label: "Pour" },
  { value: "contre", label: "Contre" },
  { value: "abstention", label: "Abstention" },
];

export function PouvoirsTab({ pouvoirs, coproprietaires, resolutions, agSessionId, canAdd = true, isReadOnly = false, onUpdate }) {
  const [showModal, setShowModal] = useState(false);
  const [mandantId, setMandantId] = useState("");
  const [mandataireId, setMandataireId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editingVotes, setEditingVotes] = useState({}); // { pouvoirId: { resolutionId: choix } }
  const [savingVotes, setSavingVotes] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [alertModal, setAlertModal] = useState(null);
  const closeModal = () => setAlertModal(null);

  // Copros qui n'ont pas encore donné de pouvoir dans cette AG
  const mandantsDisponibles = coproprietaires.filter(
    (c) => !pouvoirs.find((p) => p.mandant_id === c.id)
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
    const { data, error: err } = await pouvoirService.createWithChain(mandantId, mandataireId, agSessionId);
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setShowModal(false);
      onUpdate();
    }
  };

  const handleDelete = (id) => {
    setAlertModal({
      title: "Annuler ce pouvoir ?",
      message: "La ligne sera conservée dans l'historique (audit trail).",
      type: "confirm",
      buttons: [
        { label: "Annuler", variant: "secondary", onClick: closeModal },
        { label: "Confirmer", variant: "danger", onClick: async () => {
          closeModal();
          setDeletingId(id);
          await pouvoirService.softDelete(id);
          setDeletingId(null);
          onUpdate();
        }},
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

  const handleToggleExpand = (id, currentVotes) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      // Initialise l'état d'édition avec les votes imposés actuels
      setEditingVotes((prev) => ({ ...prev, [id]: { ...(currentVotes || {}) } }));
    }
  };

  const handleVoteImpose = (pouvoirId, resolutionId, choix) => {
    setEditingVotes((prev) => {
      const current = { ...(prev[pouvoirId] || {}) };
      if (choix === "") {
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

    // Persiste les instructions sur le pouvoir
    const ops = [
      pouvoirService.updateVotesImposes(pouvoirId, newVotesImposes),
    ];

    // Pour chaque instruction définie, enregistre immédiatement le vote du mandant
    // afin qu'il ne puisse plus être écrasé par la cascade du mandataire
    for (const [resolutionId, choix] of Object.entries(newVotesImposes)) {
      if (choix && mandant) {
        ops.push(voteService.upsert(mandant.id, resolutionId, choix, mandant.tantiemes));
      }
    }

    await Promise.all(ops);
    setSavingVotes(null);
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
              const isExpanded = expandedId === p.id;
              const nbImposes = Object.keys(p.votes_imposes || {}).length;

              return (
                <div key={p.id}>
                  {/* Ligne principale */}
                  <div className="px-5 py-3 flex items-center gap-3">
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

                    {/* Infos votes imposés */}
                    <div className="flex items-center gap-2 shrink-0">
                      {nbImposes > 0 && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                          {nbImposes} vote{nbImposes > 1 ? "s" : ""} imposé{nbImposes > 1 ? "s" : ""}
                        </span>
                      )}
                      {!isReadOnly && (
                        <>
                          <button
                            onClick={() => handleToggleExpand(p.id, p.votes_imposes)}
                            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors px-2 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title="Configurer les votes imposés"
                          >
                            <FilePen size={12} />
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40 p-1"
                            title="Supprimer ce pouvoir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Section votes imposés (dépliable) */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-zinc-50 dark:bg-zinc-800/30 border-t border-zinc-100 dark:border-zinc-800">
                      <p className="text-xs text-zinc-500 pt-3 pb-2">
                        Votes imposés par <strong className="text-zinc-700 dark:text-zinc-300">{mandant?.prenom} {mandant?.nom}</strong> — si non renseigné, le mandataire vote librement.
                      </p>
                      <div className="space-y-2">
                        {resolutions.length === 0 ? (
                          <p className="text-xs text-zinc-400 italic">Aucune résolution à l'ordre du jour.</p>
                        ) : (
                          resolutions.map((r) => {
                            const current = editingVotes[p.id]?.[r.id] || "";
                            // Instruction déjà sauvegardée en DB → verrouillée
                            const locked = !!p.votes_imposes?.[r.id];
                            return (
                              <div key={r.id} className="flex items-center gap-3">
                                <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-300 truncate">
                                  {r.titre}
                                </span>
                                {locked ? (
                                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
                                    p.votes_imposes[r.id] === "pour"
                                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                      : p.votes_imposes[r.id] === "contre"
                                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                      : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                                  }`}>
                                    {p.votes_imposes[r.id].charAt(0).toUpperCase() + p.votes_imposes[r.id].slice(1)} — voté
                                  </span>
                                ) : (
                                  <select
                                    value={current}
                                    onChange={(e) => handleVoteImpose(p.id, r.id, e.target.value)}
                                    className="text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  >
                                    {CHOIX_OPTS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="flex justify-end pt-3">
                        <button
                          onClick={() => handleSaveVotesImposes(p.id)}
                          disabled={savingVotes === p.id}
                          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {savingVotes === p.id ? "Enregistrement..." : "Sauvegarder les instructions"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
