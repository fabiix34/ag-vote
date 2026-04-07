/**
 * Couche d'accès aux données — toutes les interactions avec Supabase sont ici.
 * Les composants ne doivent jamais importer `supabase` directement.
 */
import { supabase } from "../lib/supabase";

// ─── SYNDICS ────────────────────────────────────────────────────────────────

export const syndicService = {
  fetch: (userId) =>
    supabase.from("syndics").select("*").eq("id", userId).single(),

  create: (userId, email, nom, prenom) =>
    supabase.from("syndics")
      .insert({ id: userId, email, nom, prenom })
      .select().single(),
};

// ─── COPROPRIÉTÉS ───────────────────────────────────────────────────────────

export const coproprieteService = {
  fetchBySyndic: (syndicId) =>
    supabase.from("coproprietes")
      .select("id, nom, adresse, created_at, coproprietaires(count)")
      .eq("syndic_id", syndicId)
      .order("created_at", { ascending: false }),

  fetchById: (id) =>
    supabase.from("coproprietes").select("*").eq("id", id).single(),

  create: (syndicId, nom, adresse) =>
    supabase.from("coproprietes")
      .insert({ syndic_id: syndicId, nom, adresse: adresse || null })
      .select().single(),

  updateNom: (id, nom) =>
    supabase.from("coproprietes").update({ nom }).eq("id", id),
};

// ─── AG SESSIONS ─────────────────────────────────────────────────────────────

export const agSessionService = {
  fetchByCopropriete: (coproprieteId) =>
    supabase.from("ag_sessions").select("*")
      .eq("copropriete_id", coproprieteId)
      .order("created_at", { ascending: false }),

  fetchById: (id) =>
    supabase.from("ag_sessions").select("*").eq("id", id).single(),

  fetchWithCopropriete: (id) =>
    supabase.from("ag_sessions").select("*, coproprietes(*)").eq("id", id).single(),

  fetchActive: (coproprieteId) =>
    supabase.from("ag_sessions").select("*")
      .eq("copropriete_id", coproprieteId)
      .in("statut", ["planifiee", "en_cours"])
      .order("date_ag", { ascending: false })
      .limit(1).single(),

  create: (coproprieteId, dateAg) =>
    supabase.from("ag_sessions")
      .insert({ copropriete_id: coproprieteId, statut: "planifiee", date_ag: dateAg || null })
      .select().single(),

  updateStatut: (id, statut) =>
    supabase.from("ag_sessions").update({ statut }).eq("id", id),

  updateAnticipe: (id, voteAnticipeActif, statut) =>
    supabase.from("ag_sessions").update({ vote_anticipe_actif: voteAnticipeActif, statut }).eq("id", id),

  disableAnticipe: (id) =>
    supabase.from("ag_sessions").update({ vote_anticipe_actif: false }).eq("id", id),

  terminate: (id) =>
    supabase.from("ag_sessions").update({ statut: "terminee" }).eq("id", id),
};

// ─── COPROPRIÉTAIRES ─────────────────────────────────────────────────────────

export const coproprietaireService = {
  fetchByCopropriete: (coproprieteId) =>
    supabase.from("coproprietaires").select("*")
      .eq("copropriete_id", coproprieteId)
      .order("nom"),

  fetchTantiemes: (coproprieteId) =>
    supabase.from("coproprietaires").select("tantiemes")
      .eq("copropriete_id", coproprieteId),

  fetchByLogin: (email, dateNaissance) =>
    supabase.from("coproprietaires").select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("date_naissance", dateNaissance.trim())
      .single(),

  create: (coproprieteId, payload) =>
    supabase.from("coproprietaires")
      .insert({ ...payload, copropriete_id: coproprieteId, presence: false }),

  update: (id, payload) =>
    supabase.from("coproprietaires").update(payload).eq("id", id),

  setPresence: (id, presence) =>
    supabase.from("coproprietaires").update({ presence }).eq("id", id),

  delete: (id) =>
    supabase.from("coproprietaires").delete().eq("id", id),

  upsertMany: (rows) =>
    supabase.from("coproprietaires").upsert(rows, { onConflict: "email" }),
};

// ─── RÉSOLUTIONS ─────────────────────────────────────────────────────────────

export const resolutionService = {
  fetchByAgSession: (agSessionId) =>
    supabase.from("resolutions").select("*")
      .eq("ag_session_id", agSessionId)
      .order("ordre"),

  create: (agSessionId, payload) =>
    supabase.from("resolutions")
      .insert({ ...payload, ag_session_id: agSessionId })
      .select("id").single(),

  update: (id, payload) =>
    supabase.from("resolutions").update(payload).eq("id", id),

  updateStatut: (id, statut) =>
    supabase.from("resolutions").update({ statut }).eq("id", id),

  closeAllActive: (agSessionId) =>
    supabase.from("resolutions")
      .update({ statut: "termine" })
      .eq("ag_session_id", agSessionId)
      .eq("statut", "en_cours"),

  pauseOthers: () =>
    supabase.from("resolutions").update({ statut: "en_attente" }).eq("statut", "en_cours"),

  delete: (id) =>
    supabase.from("resolutions").delete().eq("id", id),
};

// ─── VOTES ───────────────────────────────────────────────────────────────────

export const voteService = {
  fetchByResolutions: (resolutionIds) =>
    supabase.from("votes").select("*").in("resolution_id", resolutionIds),

  fetchByCopro: (coproId) =>
    supabase.from("votes").select("*").eq("coproprietaire_id", coproId),

  upsert: (coproId, resolutionId, choix, tantiemes) =>
    supabase.from("votes").upsert(
      { coproprietaire_id: coproId, resolution_id: resolutionId, choix, tantiemes_poids: tantiemes },
      { onConflict: "coproprietaire_id,resolution_id" }
    ),

  upsertAndReturn: (coproId, resolutionId, choix, tantiemes) =>
    supabase.from("votes").upsert(
      { coproprietaire_id: coproId, resolution_id: resolutionId, choix, tantiemes_poids: tantiemes },
      { onConflict: "coproprietaire_id,resolution_id" }
    ).select().single(),

  insert: (coproId, resolutionId, choix, tantiemes) =>
    supabase.from("votes").insert(
      { coproprietaire_id: coproId, resolution_id: resolutionId, choix, tantiemes_poids: tantiemes }
    ),

  update: (id, choix, tantiemes) =>
    supabase.from("votes").update({ choix, tantiemes_poids: tantiemes }).eq("id", id),

  delete: (coproId, resolutionId) =>
    supabase.from("votes").delete()
      .eq("coproprietaire_id", coproId)
      .eq("resolution_id", resolutionId),
};

// ─── POUVOIRS ────────────────────────────────────────────────────────────────

export const pouvoirService = {
  fetchByAgSession: (agSessionId) =>
    supabase.from("pouvoirs").select("*").eq("ag_session_id", agSessionId),

  fetchForMandataire: (agSessionId, mandataireId) =>
    supabase.from("pouvoirs")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes)")
      .eq("ag_session_id", agSessionId)
      .eq("mandataire_id", mandataireId),

  fetchDonne: (agSessionId, mandantId) =>
    supabase.from("pouvoirs")
      .select("*, mandataire:coproprietaires!mandataire_id(id,nom,prenom)")
      .eq("ag_session_id", agSessionId)
      .eq("mandant_id", mandantId)
      .maybeSingle(),

  create: (mandantId, mandataireId, agSessionId) =>
    supabase.from("pouvoirs")
      .insert({ mandant_id: mandantId, mandataire_id: mandataireId, ag_session_id: agSessionId, votes_imposes: {} }),

  updateVotesImposes: (id, votesImposes) =>
    supabase.from("pouvoirs").update({ votes_imposes: votesImposes }).eq("id", id),

  delete: (id) =>
    supabase.from("pouvoirs").delete().eq("id", id),
};

// ─── POUVOIR TOKENS ──────────────────────────────────────────────────────────

export const pouvoirTokenService = {
  fetchPending: (token, agSessionId) =>
    supabase.from("pouvoir_tokens")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom)")
      .eq("token", token)
      .eq("ag_session_id", agSessionId)
      .eq("used", false)
      .single(),

  fetchExisting: (mandantId, agSessionId) =>
    supabase.from("pouvoir_tokens").select("token")
      .eq("mandant_id", mandantId)
      .eq("ag_session_id", agSessionId)
      .single(),

  create: (mandantId, agSessionId) =>
    supabase.from("pouvoir_tokens")
      .insert({ mandant_id: mandantId, ag_session_id: agSessionId })
      .select("token").single(),

  markUsed: (id) =>
    supabase.from("pouvoir_tokens").update({ used: true }).eq("id", id),
};

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export const documentService = {
  fetchByResolution: (resolutionId) =>
    supabase.from("documents").select("*")
      .eq("resolution_id", resolutionId)
      .order("created_at"),

  fetchByResolutions: (resolutionIds) =>
    supabase.from("documents").select("*")
      .in("resolution_id", resolutionIds)
      .order("created_at"),

  create: (resolutionId, nom, path) =>
    supabase.from("documents").insert({ resolution_id: resolutionId, nom, path }),

  delete: (id) =>
    supabase.from("documents").delete().eq("id", id),
};

// ─── MODÈLES DE RÉSOLUTIONS ──────────────────────────────────────────────────

export const templateService = {
  fetchAll: () =>
    supabase.from("resolution_templates").select("*").order("categorie", { ascending: true }),

  create: (titre, description, categorie) =>
    supabase.from("resolution_templates")
      .insert([{ titre, description, categorie, is_custom: true }])
      .select(),

  delete: (id) =>
    supabase.from("resolution_templates").delete().eq("id", id),
};
