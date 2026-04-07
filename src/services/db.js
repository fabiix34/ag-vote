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
// Les pouvoirs "cancelled" sont conservés en base (soft-delete) pour le PV d'AG.
// Toutes les requêtes métier filtrent sur statut != 'cancelled'.

export const pouvoirService = {
  // Tous les pouvoirs actifs/en attente d'une AG (pour le syndic)
  fetchByAgSession: (agSessionId) =>
    supabase.from("pouvoirs").select("*")
      .eq("ag_session_id", agSessionId)
      .neq("statut", "cancelled"),

  // Pouvoirs reçus par un mandataire (avec données du mandant)
  fetchForMandataire: (agSessionId, mandataireId) =>
    supabase.from("pouvoirs")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes)")
      .eq("ag_session_id", agSessionId)
      .eq("mandataire_id", mandataireId)
      .neq("statut", "cancelled"),

  // Pouvoir donné par un mandant pour cette AG (actif ou en attente)
  fetchDonne: (agSessionId, mandantId) =>
    supabase.from("pouvoirs")
      .select("*, mandataire:coproprietaires!mandataire_id(id,nom,prenom)")
      .eq("ag_session_id", agSessionId)
      .eq("mandant_id", mandantId)
      .neq("statut", "cancelled")
      .maybeSingle(),

  // Historique complet pour le PV (inclut les annulés)
  fetchHistoriqueByAgSession: (agSessionId) =>
    supabase.from("pouvoirs")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes), mandataire:coproprietaires!mandataire_id(id,nom,prenom)")
      .eq("ag_session_id", agSessionId)
      .order("created_at"),

  create: (mandantId, mandataireId, agSessionId) =>
    supabase.from("pouvoirs")
      .insert({ mandant_id: mandantId, mandataire_id: mandataireId, ag_session_id: agSessionId, votes_imposes: {} })
      .select().single(),

  updateVotesImposes: (id, votesImposes) =>
    supabase.from("pouvoirs").update({ votes_imposes: votesImposes }).eq("id", id),

  // Soft-delete : marque cancelled + deleted_at, conserve la ligne pour le PV
  softDelete: (id) =>
    supabase.from("pouvoirs")
      .update({ statut: "cancelled", deleted_at: new Date().toISOString() })
      .eq("id", id),

  // Vérification du quota art. 22 (appel RPC côté frontend avant insertion)
  // Retourne { allowed, count, ratio?, reason?, detail? }
  checkQuota: (mandataireId, agSessionId, newMandantId) =>
    supabase.rpc("check_pouvoir_quota_rpc", {
      p_mandataire_id:  mandataireId,
      p_ag_session_id:  agSessionId,
      p_new_mandant_id: newMandantId,
    }),

  // ── Cycle de vie dynamique ──────────────────────────────────────────────

  // Poids de vote dynamique pour une résolution précise.
  // Retourne { total_tantiemes, own_tantiemes, mandants_count, mandants[] }
  getVotingWeight: (userId, resolutionId) =>
    supabase.rpc("get_voting_weight", {
      p_user_id:       userId,
      p_resolution_id: resolutionId,
    }),

  // Récupération de pouvoir (arrivée en séance). Respecte la règle N+1.
  // Retourne { success, pouvoir_archived_id, vote_en_cours, copro_votes_from }
  handleRecovery: (coproId, currentResolutionId) =>
    supabase.rpc("handle_power_recovery", {
      p_copro_id:               coproId,
      p_current_resolution_id:  currentResolutionId,
    }),

  // Re-délégation après départ (départ en cours de séance). Respecte N+1 + quotas.
  // Retourne { success, pouvoir_id, effective_from_id } ou { success: false, reason }
  handleRedonation: (fromId, toId, currentResolutionId) =>
    supabase.rpc("handle_power_redonation", {
      p_from_id:                fromId,
      p_to_id:                  toId,
      p_current_resolution_id:  currentResolutionId,
    }),

  // Création avec transfert de chaîne (A→B puis B→C ⟹ A→C)
  // Retourne { pouvoir_id, statut, chained_count, chained_transfers[] }
  createWithChain: (mandantId, mandataireId, agSessionId) =>
    supabase.rpc("create_pouvoir_with_chain", {
      p_mandant_id:    mandantId,
      p_mandataire_id: mandataireId,
      p_ag_session_id: agSessionId,
    }),

  // Pouvoirs actifs pour un mandataire À UNE RÉSOLUTION DONNÉE (filtre par plage)
  fetchForMandataireAtResolution: (agSessionId, mandataireId) =>
    supabase.from("pouvoirs")
      .select(`
        *,
        mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes),
        r_start:resolutions!start_resolution_id(ordre),
        r_end:resolutions!end_resolution_id(ordre)
      `)
      .eq("ag_session_id", agSessionId)
      .eq("mandataire_id", mandataireId)
      .not("statut", "in", '("cancelled","archived")'),
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

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
// Piste d'audit juridique (art. 22, loi 1965). Table immuable.
// La majorité des entrées est créée par des triggers PostgreSQL.
// Le frontend y insère uniquement les tentatives de violation de quota.

export const auditLogsService = {
  // Enregistre une tentative de violation de quota (bloquée côté frontend)
  logQuotaViolation: (agSessionId, mandataireId, detail) =>
    supabase.from("audit_logs").insert({
      ag_session_id:     agSessionId,
      coproprietaire_id: mandataireId,
      action:            "pouvoir_quota_violation",
      details:           { detail },
    }),

  logPouvoirCancelledManual: (agSessionId, mandantId, pouvoirId, mandataireId) =>
    supabase.from("audit_logs").insert({
      ag_session_id:     agSessionId,
      coproprietaire_id: mandantId,
      action:            "pouvoir_cancelled_manual",
      details:           { pouvoir_id: pouvoirId, mandataire_id: mandataireId },
    }),

  fetchByAgSession: (agSessionId) =>
    supabase.from("audit_logs").select("*")
      .eq("ag_session_id", agSessionId)
      .order("created_at", { ascending: true }),
};

// ─── LOGS AG ─────────────────────────────────────────────────────────────────
// Table immuable : pas d'UPDATE ni de DELETE côté RLS.
// types : 'connexion' | 'deconnexion' | 'pouvoir_donne' | 'pouvoir_revoque'

export const logsAgService = {
  insert: (agSessionId, coproprietaireId, type, details = {}) =>
    supabase.from("logs_ag").insert({
      ag_session_id: agSessionId || null,
      coproprietaire_id: coproprietaireId,
      type,
      details,
    }),

  fetchByAgSession: (agSessionId) =>
    supabase.from("logs_ag").select("*")
      .eq("ag_session_id", agSessionId)
      .order("created_at", { ascending: true }),
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

  update: (id, titre, description, categorie) =>
    supabase.from("resolution_templates")
      .update({ titre, description, categorie })
      .eq("id", id)
      .select()
      .single(),

  delete: (id) =>
    supabase.from("resolution_templates").delete().eq("id", id),
};
