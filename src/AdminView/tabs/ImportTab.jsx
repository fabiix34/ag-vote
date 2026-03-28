import { ImportExcel } from "../../ImportExcel/ImportExcel";

export function ImportTab({ coproprieteId, onImport }) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg)] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-zinc-900 dark:text-white">
          Import Excel des copropriétaires
        </h2>
        <ImportExcel coproprieteId={coproprieteId} onImport={onImport} />
      </div>
    </div>
  );
}
