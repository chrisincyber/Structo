// Realtime poke subscription — blueprint §12.6: one private channel per user
// carrying "something changed, pull deltas" events (sent by poke_user() in
// 0007). The payload names the table; the handler pulls that table's deltas
// and invalidates the matching queries.

import { supabase } from "./supabase";
import type { SyncedTable } from "./types";

export function subscribeToPokes(
  userId: string,
  onPoke: (table: SyncedTable) => void,
): () => void {
  const channel = supabase()
    .channel(`user:${userId}`, { config: { private: true } })
    .on("broadcast", { event: "sync_poke" }, (msg) => {
      const table = (msg.payload as { table?: SyncedTable }).table;
      if (table) onPoke(table);
    })
    .subscribe();

  return () => {
    void supabase().removeChannel(channel);
  };
}
