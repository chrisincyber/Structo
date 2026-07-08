// The mutations funnel — blueprint §14.2: every write on the web client flows
// through this module. It mirrors apply_sync_ops()'s op vocabulary (0004),
// persists pending ops to IndexedDB (outbox-lite, §11.13: a dropped connection
// or closed tab loses nothing), and flushes ordered batches. Ops are
// idempotent by op_id, so retry-after-anything is always safe.

import { supabase } from "./supabase";
import { uuidv7 } from "./uuid";

export type SyncOp =
  | { op_id: string; verb: "upsert"; table: string; row: Record<string, unknown> }
  | { op_id: string; verb: "delete"; table: string; id: string }
  | { op_id: string; verb: "complete_task"; task_id: string; permanent?: boolean };

// ---------------------------------------------------------------------------
// Outbox (IndexedDB, append-ordered by op key)
// ---------------------------------------------------------------------------

const DB_NAME = "structo";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function outboxAppend(op: SyncOp): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ op });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function outboxPeekAll(): Promise<Array<{ seq: number; op: SyncOp }>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as Array<{ seq: number; op: SyncOp }>);
    req.onerror = () => reject(req.error);
  });
}

async function outboxRemove(seqs: number[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const seq of seqs) tx.objectStore(STORE).delete(seq);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Flush loop: ordered batches -> apply_sync_ops RPC. One in-flight flush at a
// time; failures back off and everything is retried verbatim (idempotent).
// ---------------------------------------------------------------------------

let flushing = false;
let flushListeners: Array<() => void> = [];

/** Resolves after the next successful full flush (used by tests/UI). */
export function onFlushed(): Promise<void> {
  return new Promise((resolve) => flushListeners.push(resolve));
}

export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      const entries = await outboxPeekAll();
      if (entries.length === 0) break;
      const batch = entries.slice(0, 200);
      const { error } = await supabase().rpc("apply_sync_ops", {
        p_ops: batch.map((e) => e.op),
      });
      if (error) throw error;
      await outboxRemove(batch.map((e) => e.seq));
    }
    flushListeners.forEach((fn) => fn());
    flushListeners = [];
  } finally {
    flushing = false;
  }
}

/** Enqueue an op and kick a flush (fire-and-forget; errors retried later). */
export async function dispatch(op: SyncOp): Promise<void> {
  await outboxAppend(op);
  flushOutbox().catch(() => {
    // Left in the outbox; retried on next dispatch, poke, or reconnect.
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushOutbox().catch(() => {}));
}

// ---------------------------------------------------------------------------
// Typed mutation helpers — the only write API the UI is allowed to use.
// ---------------------------------------------------------------------------

export function createTask(row: {
  id?: string;
  project_id: string;
  author_id: string;
  title: string;
  [key: string]: unknown;
}): { id: string; done: Promise<void> } {
  const id = row.id ?? uuidv7();
  return { id, done: dispatch({ op_id: uuidv7(), verb: "upsert", table: "tasks", row: { ...row, id } }) };
}

export function updateRow(
  table: "tasks" | "projects" | "sections" | "labels" | "habits" | "reminders" | "dashboard_layouts" | "saved_views",
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  return dispatch({ op_id: uuidv7(), verb: "upsert", table, row: { ...patch, id } });
}

export function deleteRow(
  table: "tasks" | "projects" | "sections" | "labels" | "habits" | "habit_logs" | "reminders" | "saved_views",
  id: string,
): Promise<void> {
  return dispatch({ op_id: uuidv7(), verb: "delete", table, id });
}

export function completeTask(taskId: string, permanent = false): Promise<void> {
  return dispatch({ op_id: uuidv7(), verb: "complete_task", task_id: taskId, permanent });
}

/** Append-only habit logging (§5.4); negative value = compensating entry. */
export function logHabit(row: {
  habit_id: string;
  user_id: string;
  logged_for: string;
  value: number;
}): Promise<void> {
  return dispatch({
    op_id: uuidv7(),
    verb: "upsert",
    table: "habit_logs",
    row: { ...row, id: uuidv7() },
  });
}
