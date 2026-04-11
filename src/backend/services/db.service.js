/**
 * Couche d'accès aux données — version backend.
 * Utilise le client admin (service key) pour contourner le RLS
 * sur les opérations nécessitant des privilèges élevés.
 *
 * Identique à src/services/db.js mais importé depuis config.js.
 */
import { supabaseAdmin } from "../config.js";
import { AuditEvent } from "../utils/auditEvent.js";

const db = supabaseAdmin;

// ─── SYNDICS ─────────────────────────────────────────────────────────────────

export const syndicService = {
  fetch: (userId) =>
    db.from("syndics").select("*").eq("id", userId).single(),

  create: (userId, email, nom, prenom) =>
    db.from("syndics")
      .insert({ id: userId, email, nom, prenom })
      .select()
      .single(),
};

// ─── COPROPRIÉTÉS ────────────────────────────────────────────────────────────

export const coproprieteService = {
  fetchBySyndic: (syndicId) =>
    db.from("coproprietes")
      .select("id, nom, adresse, created_at, coproprietaires(count)")
      .eq("syndic_id", syndicId)
      .order("created_at", { ascending: false }),

  fetchById: (id) =>
    db.from("coproprietes").select("*").eq("id", id).single(),

  create: (syndicId, nom, adresse) =>
    db.from("coproprietes")
      .insert({ syndic_id: syndicId, nom, adresse: adresse || null })
      .select()
      .single(),

  updateNom: (id, nom) =>
    db.from("coproprietes").update({ nom }).eq("id", id),
};

// ─── AG SESSIONS ──────────────────────────────────────────────────────────────

export const agSessionService = {
  fetchByCopropriete: (coproprieteId) =>
    db.from("ag_sessions")
      .select("*")
      .eq("copropriete_id", coproprieteId)
      .order("created_at", { ascending: false }),

  fetchById: (id) =>
    db.from("ag_sessions").select("*").eq("id", id).single(),

  fetchWithCopropriete: (id) =>
    db.from("ag_sessions").select("*, coproprietes(*)").eq("id", id).single(),

  fetchActive: (coproprieteId) =>
    db.from("ag_sessions")
      .select("*")
      .eq("copropriete_id", coproprieteId)
      .in("statut", ["planifiee", "vote_anticipe", "en_cours"])
      .order("date_ag", { ascending: false })
      .limit(1)
      .single(),

  create: (coproprieteId, dateAg) =>
    db.from("ag_sessions")
      .insert({
        copropriete_id: coproprieteId,
        statut: "planifiee",
        date_ag: dateAg || null,
      })
      .select()
      .single(),

  updateStatut: (id, statut) =>
    db.from("ag_sessions").update({ statut }).eq("id", id),

  activateVoteAnticipe: (id) =>
    db.from("ag_sessions").update({ statut: "vote_anticipe" }).eq("id", id),

  deactivateVoteAnticipe: (id) =>
    db.from("ag_sessions").update({ statut: "en_cours" }).eq("id", id),

  terminate: (id) =>
    db.from("ag_sessions").update({ statut: "terminee" }).eq("id", id),
};

// ─── COPROPRIÉTAIRES ─────────────────────────────────────────────────────────

export const coproprietaireService = {
  fetchByCopropriete: (coproprieteId) =>
    db.from("coproprietaires")
      .select("*")
      .eq("copropriete_id", coproprieteId)
      .order("nom"),

  fetchTantiemes: (coproprieteId) =>
    db.from("coproprietaires").select("tantiemes").eq("copropriete_id", coproprieteId),

  fetchByLogin: (email, dateNaissance) =>
    db.from("coproprietaires")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("date_naissance", dateNaissance.trim())
      .single(),

  create: (coproprieteId, payload) =>
    db.from("coproprietaires").insert({
      ...payload,
      copropriete_id: coproprieteId,
      presence: false,
    }),

  update: (id, payload) =>
    db.from("coproprietaires").update(payload).eq("id", id),

  setPresence: (id, presence) =>
    db.from("coproprietaires").update({ presence }).eq("id", id),

  resetAllPresence: (coproprieteId) =>
    db.from("coproprietaires")
      .update({ presence: false })
      .eq("copropriete_id", coproprieteId),

  delete: (id) =>
    db.from("coproprietaires").delete().eq("id", id),

  upsertMany: (rows) =>
    db.from("coproprietaires").upsert(rows, { onConflict: "email" }),
};

// ─── RÉSOLUTIONS ─────────────────────────────────────────────────────────────

export const resolutionService = {
  fetchByAgSession: (agSessionId) =>
    db.from("resolutions")
      .select("*")
      .eq("ag_session_id", agSessionId)
      .order("ordre"),

  create: (agSessionId, payload) =>
    db.from("resolutions")
      .insert({ ...payload, ag_session_id: agSessionId })
      .select("id")
      .single(),

  update: (id, payload) =>
    db.from("resolutions").update(payload).eq("id", id),

  updateStatut: (id, statut) =>
    db.from("resolutions").update({ statut }).eq("id", id),

  closeAllActive: (agSessionId) =>
    db.from("resolutions")
      .update({ statut: "termine" })
      .eq("ag_session_id", agSessionId)
      .eq("statut", "en_cours"),

  pauseOthers: () =>
    db.from("resolutions").update({ statut: "en_attente" }).eq("statut", "en_cours"),

  delete: (id) =>
    db.from("resolutions").delete().eq("id", id),
};

// ─── VOTES ───────────────────────────────────────────────────────────────────

export const voteService = {
  fetchByResolutions: (resolutionIds) =>
    db.from("votes").select("*").in("resolution_id", resolutionIds),

  fetchByCopro: (coproId) =>
    db.from("votes").select("*").eq("coproprietaire_id", coproId),

  upsert: (coproId, resolutionId, choix, tantiemes) =>
    db.from("votes").upsert(
      {
        coproprietaire_id: coproId,
        resolution_id: resolutionId,
        choix,
        tantiemes_poids: tantiemes,
      },
      { onConflict: "coproprietaire_id,resolution_id" }
    ),

  upsertAndReturn: (coproId, resolutionId, choix, tantiemes) =>
    db.from("votes")
      .upsert(
        {
          coproprietaire_id: coproId,
          resolution_id: resolutionId,
          choix,
          tantiemes_poids: tantiemes,
        },
        { onConflict: "coproprietaire_id,resolution_id" }
      )
      .select()
      .single(),

  delete: (coproId, resolutionId) =>
    db.from("votes")
      .delete()
      .eq("coproprietaire_id", coproId)
      .eq("resolution_id", resolutionId),

  // ── RPCs atomiques ──────────────────────────────────────────────────────────

  submitVpc: (voterId, resolutionId, choix, mandantIds = [], metadata = {}) =>
    db.rpc("submit_vpc_vote", {
      p_voter_id:      voterId,
      p_resolution_id: resolutionId,
      p_choix:         choix,
      p_mandant_ids:   mandantIds,
      p_metadata:      metadata,
    }),

  submitLive: (voterId, resolutionId, choix, mandantIds = [], metadata = {}) =>
    db.rpc("submit_live_vote", {
      p_voter_id:      voterId,
      p_resolution_id: resolutionId,
      p_choix:         choix,
      p_mandant_ids:   mandantIds,
      p_metadata:      metadata,
    }),

  submitManualSyndic: (syndicId, coproId, resolutionId, choix, mandantIds = [], metadata = {}) =>
    db.rpc("submit_manual_syndic_vote", {
      p_syndic_id:     syndicId,
      p_copro_id:      coproId,
      p_resolution_id: resolutionId,
      p_choix:         choix,
      p_mandant_ids:   mandantIds,
      p_metadata:      metadata,
    }),
};

// ─── POUVOIRS ────────────────────────────────────────────────────────────────

export const pouvoirService = {
  fetchByAgSession: (agSessionId) =>
    db.from("pouvoirs")
      .select("*")
      .eq("ag_session_id", agSessionId)
      .neq("statut", "cancelled"),

  fetchForMandataire: (agSessionId, mandataireId) =>
    db.from("pouvoirs")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes)")
      .eq("ag_session_id", agSessionId)
      .eq("mandataire_id", mandataireId)
      .neq("statut", "cancelled"),

  fetchDonne: (agSessionId, mandantId) =>
    db.from("pouvoirs")
      .select("*, mandataire:coproprietaires!mandataire_id(id,nom,prenom)")
      .eq("ag_session_id", agSessionId)
      .eq("mandant_id", mandantId)
      .neq("statut", "cancelled")
      .maybeSingle(),

  fetchHistoriqueByAgSession: (agSessionId) =>
    db.from("pouvoirs")
      .select(
        "*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes), mandataire:coproprietaires!mandataire_id(id,nom,prenom)"
      )
      .eq("ag_session_id", agSessionId)
      .order("created_at"),

  create: (mandantId, mandataireId, agSessionId) =>
    db.from("pouvoirs")
      .insert({
        mandant_id: mandantId,
        mandataire_id: mandataireId,
        ag_session_id: agSessionId,
        votes_imposes: {},
      })
      .select()
      .single(),

  updateVotesImposes: (id, votesImposes) =>
    db.from("pouvoirs").update({ votes_imposes: votesImposes }).eq("id", id),

  softDelete: (id) =>
    db.from("pouvoirs")
      .update({ statut: "cancelled", deleted_at: new Date().toISOString() })
      .eq("id", id),

  checkQuota: (mandataireId, agSessionId, newMandantId) =>
    db.rpc("check_pouvoir_quota_rpc", {
      p_mandataire_id:  mandataireId,
      p_ag_session_id:  agSessionId,
      p_new_mandant_id: newMandantId,
    }),

  getVotingWeight: (userId, resolutionId) =>
    db.rpc("get_voting_weight", {
      p_user_id:       userId,
      p_resolution_id: resolutionId,
    }),

  handleRecovery: (coproId, currentResolutionId) =>
    db.rpc("handle_power_recovery", {
      p_copro_id:              coproId,
      p_current_resolution_id: currentResolutionId,
    }),

  handleRedonation: (fromId, toId, currentResolutionId) =>
    db.rpc("handle_power_redonation", {
      p_from_id:               fromId,
      p_to_id:                 toId,
      p_current_resolution_id: currentResolutionId,
    }),

  createWithChain: (mandantId, mandataireId, agSessionId) =>
    db.rpc("create_pouvoir_with_chain", {
      p_mandant_id:    mandantId,
      p_mandataire_id: mandataireId,
      p_ag_session_id: agSessionId,
    }),

  fetchForMandataireAtResolution: (agSessionId, mandataireId) =>
    db.from("pouvoirs")
      .select(
        `*, mandant:coproprietaires!mandant_id(id,nom,prenom,tantiemes),
        r_start:resolutions!start_resolution_id(ordre),
        r_end:resolutions!end_resolution_id(ordre)`
      )
      .eq("ag_session_id", agSessionId)
      .eq("mandataire_id", mandataireId)
      .not("statut", "in", '("cancelled","archived")'),
};

// ─── POUVOIR TOKENS ──────────────────────────────────────────────────────────

export const pouvoirTokenService = {
  fetchPending: (token, agSessionId) =>
    db.from("pouvoir_tokens")
      .select("*, mandant:coproprietaires!mandant_id(id,nom,prenom)")
      .eq("token", token)
      .eq("ag_session_id", agSessionId)
      .eq("used", false)
      .single(),

  fetchExisting: (mandantId, agSessionId) =>
    db.from("pouvoir_tokens")
      .select("token")
      .eq("mandant_id", mandantId)
      .eq("ag_session_id", agSessionId)
      .single(),

  create: (mandantId, agSessionId) =>
    db.from("pouvoir_tokens")
      .insert({ mandant_id: mandantId, ag_session_id: agSessionId })
      .select("token")
      .single(),

  markUsed: (id) =>
    db.from("pouvoir_tokens").update({ used: true }).eq("id", id),
};

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

export const auditLogsService = {
  logQuotaViolation: (agSessionId, mandataireId, detail) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId,
      coproprietaire_id: mandataireId,
      user_id:           mandataireId,
      action:            "pouvoir_quota_violation",
      details:           { detail },
      payload:           { detail },
    }),

  logPouvoirCancelledManual: (agSessionId, mandantId, pouvoirId, mandataireId, tantiemes) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId,
      coproprietaire_id: mandantId,
      user_id:           mandantId,
      target_user_id:    mandataireId,
      action:            "pouvoir_cancelled_manual",
      event_type:        AuditEvent.POWER_RECOVERED,
      details:           { pouvoir_id: pouvoirId, mandataire_id: mandataireId },
      payload:           {
        pouvoir_id: pouvoirId,
        mandataire_id: mandataireId,
        tantiemes_snapshot: tantiemes ?? 0,
      },
    }),

  logAuthEvent: (coproId, agSessionId, eventType, metadata = {}) =>
    db.rpc("log_auth_event", {
      p_copro_id:      coproId,
      p_ag_session_id: agSessionId ?? null,
      p_event_type:    eventType,
      p_metadata:      metadata,
    }),

  logPresenceEvent: (agSessionId, coproId, arrived, details = {}) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId || null,
      coproprietaire_id: coproId,
      user_id:           coproId,
      action:            arrived ? "arrivee_physique" : "depart_physique",
      event_type:        arrived ? AuditEvent.ATTENDANCE_ARRIVED : AuditEvent.ATTENDANCE_LEFT,
      details,
      payload:           details,
    }),

  logPouvoirDonne: (agSessionId, mandantId, details = {}) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId || null,
      coproprietaire_id: mandantId,
      user_id:           mandantId,
      action:            "pouvoir_donne",
      event_type:        AuditEvent.POWER_GIVEN,
      details,
      payload:           details,
    }),

  logPouvoirRevoque: (agSessionId, coproId, details = {}) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId || null,
      coproprietaire_id: coproId,
      user_id:           coproId,
      action:            "pouvoir_revoque",
      event_type:        AuditEvent.POWER_RECOVERED,
      details,
      payload:           details,
    }),

  logPouvoirCreatedSyndic: (agSessionId, mandantId, details = {}) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId || null,
      coproprietaire_id: mandantId,
      user_id:           mandantId,
      action:            "pouvoir_created_syndic",
      event_type:        AuditEvent.POWER_CREATED_SYNDIC,
      details,
      payload:           details,
    }),

  logPouvoirDeletedSyndic: (agSessionId, mandantId, details = {}) =>
    db.from("audit_logs").insert({
      ag_session_id:     agSessionId || null,
      coproprietaire_id: mandantId,
      user_id:           mandantId,
      action:            "pouvoir_deleted_syndic",
      event_type:        AuditEvent.POWER_DELETED_SYNDIC,
      details,
      payload:           details,
    }),

  fetchByAgSession: (agSessionId) =>
    db.from("audit_logs")
      .select("*")
      .eq("ag_session_id", agSessionId)
      .order("created_at", { ascending: true }),

  fetchByCopropriete: (agSessionIds) =>
    db.from("audit_logs")
      .select("*")
      .in("ag_session_id", agSessionIds)
      .order("created_at", { ascending: false }),
};

// ─── DOCUMENTS ───────────────────────────────────────────────────────────────

export const documentService = {
  fetchByResolution: (resolutionId) =>
    db.from("documents")
      .select("*")
      .eq("resolution_id", resolutionId)
      .order("created_at"),

  fetchByResolutions: (resolutionIds) =>
    db.from("documents")
      .select("*")
      .in("resolution_id", resolutionIds)
      .order("created_at"),

  create: (resolutionId, nom, path) =>
    db.from("documents").insert({ resolution_id: resolutionId, nom, path }),

  delete: (id) =>
    db.from("documents").delete().eq("id", id),

  getSignedUrls: (paths, expiresIn = 3600) =>
    db.storage.from("resolution-docs").createSignedUrls(paths, expiresIn),
};

// ─── MODÈLES DE RÉSOLUTIONS ──────────────────────────────────────────────────

export const templateService = {
  fetchAll: () =>
    db.from("resolution_templates")
      .select("*")
      .order("categorie", { ascending: true }),

  create: (titre, description, categorie) =>
    db.from("resolution_templates")
      .insert([{ titre, description, categorie, is_custom: true }])
      .select(),

  update: (id, titre, description, categorie) =>
    db.from("resolution_templates")
      .update({ titre, description, categorie })
      .eq("id", id)
      .select()
      .single(),

  delete: (id) =>
    db.from("resolution_templates").delete().eq("id", id),
};
