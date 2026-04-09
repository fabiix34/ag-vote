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
export function useRealtime(table, callback, { onStatusChange, filter } = {}) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    const generateId = () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

    const channelName = `realtime-${table}-${generateId()}`;

    const config = { event: "*", schema: "public", table };
    if (filter) config.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", config, (payload) => callbackRef.current(payload))
      .subscribe((status) => {
        onStatusChangeRef.current?.(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]); // se ré-abonne si table ou filtre change
}
