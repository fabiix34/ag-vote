import { CoproprietairesTable } from "../../CoproprietairesTable/CoproprietairesTable";

export function CoprosTab({ coproprietaires, coproprieteId, isReadOnly = false, onSave, onDelete }) {
  const onMutate = () => { onSave?.(); onDelete?.(); };

  return (
    <CoproprietairesTable
      coproprietaires={coproprietaires}
      coproprieteId={coproprieteId}
      showPresence={isReadOnly}
      canAdd={!isReadOnly}
      canEdit={!isReadOnly}
      canDelete={!isReadOnly}
      onMutate={onMutate}
    />
  );
}
