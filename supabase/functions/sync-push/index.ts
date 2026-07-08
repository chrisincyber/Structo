// sync-push — the single mutation endpoint for client outboxes (blueprint §12.3/§13.6).
//
// Thin by design: authentication, shape validation, and size caps live here;
// atomicity, idempotent op dedupe, and every permission check live in
// public.apply_sync_ops() (SECURITY INVOKER — the user's own JWT is forwarded,
// so RLS applies exactly as it would to direct PostgREST writes).
//
// Request:  POST { ops: [{op_id, verb, ...}] }   (<= 200 ops, applied in order)
// Response: 200 { applied, deduped, server_time, results: [...] }
//           4xx/5xx { error }
//
// The whole batch is one transaction: any failing op rolls back the batch and
// the client retries it unchanged (ops are idempotent, replays dedupe).

import { createClient } from "npm:@supabase/supabase-js@2";

type SyncOp = {
  op_id: string;
  verb: "upsert" | "delete" | "complete_task";
  [key: string]: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return bad(405, "POST only");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return bad(401, "missing Authorization header");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return bad(401, "invalid or expired token");

  let body: { ops?: SyncOp[] };
  try {
    body = await req.json();
  } catch {
    return bad(400, "body must be JSON");
  }

  const ops = body.ops;
  if (!Array.isArray(ops) || ops.length === 0) {
    return bad(400, "ops must be a non-empty array");
  }
  if (ops.length > 200) return bad(400, "op batch too large (max 200)");
  for (const op of ops) {
    if (!UUID_RE.test(op.op_id ?? "")) return bad(400, "every op needs a uuid op_id");
    if (!["upsert", "delete", "complete_task"].includes(op.verb)) {
      return bad(400, `unknown verb: ${op.verb}`);
    }
  }

  const { data, error } = await supabase.rpc("apply_sync_ops", { p_ops: ops });
  if (error) {
    // RLS violations and constraint errors surface here; the client treats
    // 409 as "re-pull, then decide", not silent retry-forever.
    const status = error.code === "42501" ? 403 : 409;
    return bad(status, error.message);
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
