/**
 * Client HTTP centralisé vers le backend Node.js.
 *
 * - Attache automatiquement le Bearer token du syndic connecté (Supabase session).
 * - Attache X-Copro-Id si un profil copropriétaire est présent en localStorage.
 * - Retourne toujours { data, error } pour conserver l'interface Supabase.
 */
import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function getHeaders() {
  const headers = { "Content-Type": "application/json" };

  // Syndic JWT
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  // Copropriétaire (sans Supabase auth — identifié par son ID)
  try {
    const stored = localStorage.getItem("copro_profile");
    if (stored) {
      const profile = JSON.parse(stored);
      if (profile?.id) headers["X-Copro-Id"] = profile.id;
    }
  } catch {}

  return headers;
}

async function req(method, path, { body, params } = {}) {
  let url = `${BASE}/api${path}`;

  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length) url += `?${new URLSearchParams(entries).toString()}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: await getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return { data: null, error: null };

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: { message: json.error ?? res.statusText } };
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

/**
 * Télécharge un fichier binaire depuis le backend (ex: PV DOCX).
 * Déclenche le téléchargement navigateur automatiquement.
 */
export async function downloadFile(path, body, filename) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { "Content-Type": "application/json" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Erreur ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = {
  get:   (path, params) => req("GET",    path, { params }),
  post:  (path, body)   => req("POST",   path, { body }),
  patch: (path, body)   => req("PATCH",  path, { body }),
  del:   (path, body)   => req("DELETE", path, { body }),
};
