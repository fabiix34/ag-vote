// ============================================================
// COMPOSANT ADMIN : Import Excel des copropriétaires
// ============================================================
import { useState, useRef } from "react";
import { Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../App";
import { formatTantiemes } from "../hooks/formatTantieme";

export function ImportExcel({ coproprieteId, onImport }) {
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      const normalized = data
        .map((row) => ({
          nom: row["Nom"] || row["nom"] || "",
          prenom: row["Prénom"] || row["prenom"] || "",
          email: row["Email"] || row["email"] || "",
          date_naissance: String(row["DateNaissance"] || row["date_naissance"] || ""),
          tantiemes: parseInt(row["Tantièmes"] || row["tantiemes"] || 0),
        }))
        .filter((r) => r.email);
      setPreview(normalized);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setLoading(true);
    const rows = preview.map((r) => ({
      ...r,
      ...(coproprieteId ? { copropriete_id: coproprieteId } : {}),
    }));
    const { error } = await supabase
      .from("coproprietaires")
      .upsert(rows, { onConflict: "email" });
    setLoading(false);
    if (!error) {
      onImport();
      setPreview([]);
      fileRef.current.value = "";
    } else {
      alert("Erreur import: " + error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileRef.current.click()}
        className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors group"
      >
        <Upload
          className="mx-auto mb-2 text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors"
          size={32}
        />
        <p className="text-zinc-600 dark:text-zinc-400 text-sm">
          Cliquer pour importer un fichier Excel
        </p>
        <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-1">
          Colonnes attendues: Nom, Prénom, Email, DateNaissance (DDMMYYYY), Tantièmes
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {preview.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {preview.length} copropriétaire(s) détectés
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-xs">
              <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                <tr>
                  {["Nom", "Prénom", "Email", "Naissance", "Tantièmes"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-zinc-500 dark:text-zinc-400 font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{r.nom}</td>
                    <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{r.prenom}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{r.email}</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                      {r.date_naissance}
                    </td>
                    <td className="px-3 py-2 text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatTantiemes(r.tantiemes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {loading
              ? "Import en cours..."
              : `Importer ${preview.length} copropriétaire${preview.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
