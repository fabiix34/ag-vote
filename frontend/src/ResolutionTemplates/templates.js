import { api } from '../lib/api';

const PLACEHOLDER_RE = /\{\{([\w\u00C0-\u017F]+)\}\}/g;

// --- Utilitaires (inchangés car ils traitent du texte brut) ---
export function extractPlaceholders(text) {
  if (!text) return [];
  const seen = new Set();
  const result = [];
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); result.push(m[1]); }
  }
  return result;
}

/** Découpe le texte en segments pour l'aperçu cliquable */
export function splitByPlaceholders(text) {
  if (!text) return [];
  const parts = [];
  let last = 0;
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    // Texte avant le placeholder
    if (m.index > last) {
      parts.push({ type: 'text', text: text.slice(last, m.index) });
    }
    // Le placeholder lui-même
    parts.push({ type: 'placeholder', key: m[1] });
    last = m.index + m[0].length;
  }
  // Texte après le dernier placeholder
  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) });
  }
  return parts;
}

export function applyValues(text, values) {
  if (!text) return "";
  return text.replace(/\{\{([\w\u00C0-\u017F]+)\}\}/g, (match, key) => values[key]?.trim() || match);
}

export function formatLabel(key) {
  return key.replace(/_/g, ' ').split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
}

// --- Fonctions Database ---

/** Récupère tous les modèles depuis le backend */
export async function getModeles() {
  const { data, error } = await api.get("/templates");
  if (error) {
    console.error("Erreur lors de la récupération des modèles:", error);
    return [];
  }
  return data;
}

/** Ajoute un nouveau modèle à la bibliothèque */
export async function saveAsTemplate(titre, description, categorie) {
  const { data, error } = await api.post("/templates", { titre, description, categorie });
  if (error) throw new Error(error.message);
  return data;
}

/** Supprime un modèle */
export async function deleteTemplate(id) {
  const { error } = await api.del(`/templates/${id}`);
  if (error) throw new Error(error.message);
}