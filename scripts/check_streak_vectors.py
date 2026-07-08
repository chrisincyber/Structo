#!/usr/bin/env python3
"""Run spec/streaks/vectors.json against public.compute_streak() in Postgres.

Emits SQL (a DO block that raises on any mismatch); psql does the checking:

    python3 scripts/check_streak_vectors.py | psql "$DB_URL" -v ON_ERROR_STOP=1 -f -
"""

import json
import pathlib

data = json.loads(
    (pathlib.Path(__file__).parent.parent / "spec/streaks/vectors.json").read_text()
)

print("do $$")
print("declare got jsonb; failures int := 0;")
print("begin")
for v in data["vectors"]:
    habit = json.dumps(v["habit"]).replace("'", "''")
    logs = json.dumps(v["logs"]).replace("'", "''")
    week_start = v.get("week_start", 1)
    exp = v["expect"]
    print(
        f"  got := public.compute_streak('{habit}'::jsonb, '{logs}'::jsonb, "
        f"'{v['today']}'::date, {week_start});\n"
        f"  if (got ->> 'current')::int is distinct from {exp['current']}\n"
        f"     or (got ->> 'best')::int is distinct from {exp['best']}\n"
        f"     or got ->> 'unit' is distinct from '{exp['unit']}' then\n"
        f"    raise warning 'VECTOR FAILED: {v['name']} — expected {json.dumps(exp)}, got %', got;\n"
        f"    failures := failures + 1;\n"
        f"  else\n"
        f"    raise notice 'ok: {v['name']}';\n"
        f"  end if;"
    )
print("  if failures > 0 then raise exception '% streak vector(s) failed', failures; end if;")
print("end; $$;")
