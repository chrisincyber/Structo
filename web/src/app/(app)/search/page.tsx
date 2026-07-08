"use client";

// Global search (§3.6): instant, grouped results — tasks (FTS over the
// generated search column), projects and habits (name match). Habits are a
// separate result group, never mixed into task results (§5.10).

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { TaskRow } from "@/components/TaskRow";
import { supabase } from "@/lib/supabase";
import type { Habit, Project, Task } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/ui";

type Results = { tasks: Task[]; projects: Project[]; habits: Habit[] };

async function search(q: string): Promise<Results> {
  const [tasks, projects, habits] = await Promise.all([
    supabase()
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .textSearch("search", q, { type: "websearch", config: "simple" })
      .limit(20),
    supabase()
      .from("projects")
      .select("*")
      .is("deleted_at", null)
      .eq("is_inbox", false)
      .ilike("name", `%${q}%`)
      .limit(10),
    supabase()
      .from("habits")
      .select("*")
      .is("deleted_at", null)
      .ilike("name", `%${q}%`)
      .limit(10),
  ]);
  for (const r of [tasks, projects, habits]) {
    if (r.error) throw r.error;
  }
  return {
    tasks: tasks.data as Task[],
    projects: projects.data as Project[],
    habits: habits.data as Habit[],
  };
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length >= 2,
  });

  const open = (results.data?.tasks ?? []).filter((t) => !t.completed_at);
  const completed = (results.data?.tasks ?? []).filter((t) => t.completed_at);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search tasks, projects, habits…"
        className="mt-4 mb-6 w-full rounded-[10px] border border-hairline bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-accent"
      />

      {debounced.length < 2 ? (
        <p className="text-sm text-muted">Type at least two characters.</p>
      ) : results.isLoading ? (
        <p className="text-muted">Searching…</p>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Tasks
              </h2>
              <ul>{open.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
            </section>
          )}
          {(results.data?.projects.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Projects
              </h2>
              <ul>
                {results.data!.projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/project/${p.id}`}
                      className="flex items-center gap-2 border-b border-hairline py-3 hover:bg-hairline/30"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: PROJECT_COLORS[p.color] ?? PROJECT_COLORS.stone }}
                      />
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(results.data?.habits.length ?? 0) > 0 && (
            <section>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Habits
              </h2>
              <ul>
                {results.data!.habits.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/habit/${h.id}`}
                      className="block border-b border-hairline py-3 hover:bg-hairline/30"
                    >
                      {h.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Completed
              </h2>
              <ul>
                {completed.map((t) => (
                  <li key={t.id} className="border-b border-hairline py-3 text-muted line-through">
                    {t.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {open.length === 0 &&
            completed.length === 0 &&
            results.data?.projects.length === 0 &&
            results.data?.habits.length === 0 && (
              <p className="py-8 text-center text-muted">No results.</p>
            )}
        </div>
      )}
    </div>
  );
}
