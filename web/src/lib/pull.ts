// Delta-pull client — blueprint §13.6/§14.2: per-table cursors against
// pull_table_deltas() (0006). Pulled rows land in the TanStack Query cache
// via the caller; this module owns cursor state and paging only.

import { supabase } from "./supabase";
import { SYNCED_TABLES, type SyncedTable } from "./types";

type Cursor = { since: string; after_id: string };

const EPOCH: Cursor = {
  since: "-infinity",
  after_id: "00000000-0000-0000-0000-000000000000",
};

const CURSOR_KEY = "planoa.cursors.v1";

function loadCursors(): Partial<Record<SyncedTable, Cursor>> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CURSOR_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveCursors(c: Partial<Record<SyncedTable, Cursor>>): void {
  localStorage.setItem(CURSOR_KEY, JSON.stringify(c));
}

export type PullResult<T = Record<string, unknown>> = {
  table: SyncedTable;
  rows: T[];
};

/** Pull every page of new/changed rows (tombstones included) for one table. */
export async function pullTable<T = Record<string, unknown>>(
  table: SyncedTable,
): Promise<PullResult<T>> {
  const cursors = loadCursors();
  let cursor = cursors[table] ?? EPOCH;
  const rows: T[] = [];

  for (;;) {
    const { data, error } = await supabase().rpc("pull_table_deltas", {
      p_table: table,
      p_since: cursor.since,
      p_after_id: cursor.after_id,
      p_limit: 500,
    });
    if (error) throw error;

    const page = data as {
      rows: T[];
      has_more: boolean;
      next_cursor: Cursor | null;
    };
    rows.push(...page.rows);
    if (page.next_cursor) cursor = page.next_cursor;
    if (!page.has_more) break;
  }

  cursors[table] = cursor;
  saveCursors(cursors);
  return { table, rows };
}

/** Pull all synced tables (initial sync and poke-triggered refresh). */
export async function pullAll(): Promise<PullResult[]> {
  return Promise.all(SYNCED_TABLES.map((t) => pullTable(t)));
}

/** Drop cursors (sign-out or full resync). */
export function resetCursors(): void {
  if (typeof window !== "undefined") localStorage.removeItem(CURSOR_KEY);
}
