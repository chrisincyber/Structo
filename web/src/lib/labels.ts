// Label writes. Labels themselves flow through the op path (they're in the
// apply_sync_ops whitelist, 0004). task_labels assignments use direct
// PostgREST — the composite PK keeps them out of the generic op path by
// design, and RLS (0002) enforces label-ownership + project-membership.

import { dispatch } from "./ops";
import { supabase } from "./supabase";
import { uuidv7 } from "./uuid";
import type { Label } from "./types";

export function createLabel(row: {
  owner_id: string;
  name: string;
  color: string;
}): { id: string; done: Promise<void> } {
  const id = uuidv7();
  return {
    id,
    done: dispatch({
      op_id: uuidv7(),
      verb: "upsert",
      table: "labels",
      row: { ...row, id },
    }),
  };
}

export async function assignLabel(taskId: string, labelId: string): Promise<void> {
  const { error } = await supabase()
    .from("task_labels")
    .upsert({ task_id: taskId, label_id: labelId, deleted_at: null });
  if (error) throw error;
}

export async function unassignLabel(taskId: string, labelId: string): Promise<void> {
  // Tombstone, consistent with the rest of the sync model (§11.9).
  const { error } = await supabase()
    .from("task_labels")
    .update({ deleted_at: new Date().toISOString() })
    .eq("task_id", taskId)
    .eq("label_id", labelId);
  if (error) throw error;
}

/** Next curated label color (cycles the project palette names). */
export const LABEL_COLORS = [
  "teal",
  "grape",
  "clay",
  "sky",
  "moss",
  "rose",
  "sand",
  "indigo",
] as const;

export function nextLabelColor(existing: Label[]): string {
  return LABEL_COLORS[existing.length % LABEL_COLORS.length];
}
