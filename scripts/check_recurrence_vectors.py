#!/usr/bin/env python3
"""Run spec/recurrence/vectors.json against public.next_occurrence() in Postgres.

Generates one SELECT per vector and fails (exit 1) on any mismatch. Used by CI
after migrations are applied; also runnable locally:

    python3 scripts/check_recurrence_vectors.py | psql "$DB_URL" -v ON_ERROR_STOP=1 -f -

The script only emits SQL; psql does the checking via a DO block that raises
on the first failing vector.
"""

import json
import pathlib

vectors = json.loads(
    (pathlib.Path(__file__).parent.parent / "spec/recurrence/vectors.json").read_text()
)["vectors"]

print("do $$")
print("declare got date; failures int := 0;")
print("begin")
for v in vectors:
    rule = json.dumps(v["rule"]).replace("'", "''")
    anchor = f"'{v['anchor']}'::date" if "anchor" in v else "null"
    print(
        f"  got := public.next_occurrence('{rule}'::jsonb, '{v['from']}'::date, {anchor});\n"
        f"  if got is distinct from '{v['expect_next']}'::date then\n"
        f"    raise warning 'VECTOR FAILED: {v['name']} — expected {v['expect_next']}, got %', got;\n"
        f"    failures := failures + 1;\n"
        f"  else\n"
        f"    raise notice 'ok: {v['name']}';\n"
        f"  end if;"
    )
print("  if failures > 0 then raise exception '% recurrence vector(s) failed', failures; end if;")
print("end; $$;")
