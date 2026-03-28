
// ============================================================
// COMPOSANT : Documents d'une résolution
// ============================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../App";
import { Paperclip, Plus, AlertCircle, FileText, ExternalLink, Trash2 } from "lucide-react";

export function DocumentsSection({ resolutionId, canManage }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef();

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("resolution_id", resolutionId)
      .order("created_at");
    const rows = data || [];
    if (rows.length > 0) {
      const { data: signed } = await supabase.storage
        .from("resolution-docs")
        .createSignedUrls(rows.map((d) => d.path), 3600);
      setDocs(rows.map((doc, i) => ({ ...doc, signedUrl: signed?.[i]?.signedUrl ?? null })));
    } else {
      setDocs([]);
    }
  }, [resolutionId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const sanitizeFilename = (name) =>
    name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const path = `${resolutionId}/${Date.now()}-${sanitizeFilename(file.name)}`;
    const { error: storageError } = await supabase.storage
      .from("resolution-docs")
      .upload(path, file);
    if (!storageError) {
      const { error: dbError } = await supabase.from("documents").insert({ resolution_id: resolutionId, nom: file.name, path });
      if (dbError) {
        await supabase.storage.from("resolution-docs").remove([path]);
        setUploadError(dbError.message);
      } else {
        setUploadError("");
        fetchDocs();
      }
    } else {
      setUploadError(storageError.message);
    }
    setUploading(false);
    fileRef.current.value = "";
  };

  const handleDelete = async (doc) => {
    await supabase.storage.from("resolution-docs").remove([doc.path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    fetchDocs();
  };

  if (docs.length === 0 && !canManage) return null;

  const inner = (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <Paperclip size={11} /> Documents {docs.length > 0 && `(${docs.length})`}
        </p>
        {canManage && (
          <>
            <button
              onClick={() => fileRef.current.click()}
              disabled={uploading}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-50 transition-opacity"
            >
              <Plus size={11} /> {uploading ? "Envoi..." : "Ajouter"}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          </>
        )}
      </div>
      {uploadError && (
        <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
          <AlertCircle size={11} /> {uploadError}
        </p>
      )}
      {docs.length > 0 && (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg px-2.5 py-1.5 text-xs">
              <FileText size={11} className="text-zinc-400 shrink-0" />
              <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">{doc.nom}</span>
              <a
                href={doc.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors shrink-0"
                title="Ouvrir"
              >
                <ExternalLink size={11} />
              </a>
              {canManage && (
                <button
                  onClick={() => handleDelete(doc)}
                  className="text-zinc-400 hover:text-red-500 transition-colors shrink-0"
                  title="Supprimer"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {docs.length === 0 && canManage && (
        <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">Aucun document joint</p>
      )}
    </div>
  );

  if (!canManage) {
    return (
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
        {inner}
      </div>
    );
  }

  return inner;
}
