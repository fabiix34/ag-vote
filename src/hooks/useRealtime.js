// ============================================================
// HOOK : Supabase Realtime
// ============================================================

import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

/**
 * S'abonne aux changements d'une table Supabase en temps réel.
 * - Nom de channel unique par instance → pas de conflit entre composants
 * - callbackRef → jamais de callback périmé, pas besoin de useCallback côté appelant
 * - onStatusChange (optionnel) → suivi de l'état de connexion
 */
export function useRealtime(table, callback, { onStatusChange } = {}) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    // Générateur d'ID de secours si crypto.randomUUID n'est pas dispo
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      // Fallback simple pour le nom du channel
      return Math.random().toString(36).substring(2, 15);
    };

    const channelName = `realtime-${table}-${generateId()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => callbackRef.current(payload)
      )
      .subscribe((status) => {
        onStatusChangeRef.current?.(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]); // uniquement si la table change (jamais en pratique)
}
