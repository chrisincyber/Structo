"use client";

// Completed (§11.9): neither archived nor deleted — a permanent, cheap,
// valuable record. Uncomplete restores in place.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateRow } from "@/lib/ops";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/lib/types";

async function fetchCompleted(): Promise<Task[]> {
  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as Task[];
}

export default function CompletedPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ["tasks", "completed"], queryFn: fetchCompleted });

  function uncomplete(task: Task) {
    queryClient.setQueryData<Task[]>(["tasks", "completed"], (old) =>
      old?.filter((t) => t.id !== task.id),
    );
    void updateRow("tasks", task.id, { completed_at: null, completed_by: null });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Completed</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">The done pile. It counts.</p>

      {tasks.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : tasks.data && tasks.data.length > 0 ? (
        <ul>
          {tasks.data.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-hairline py-3">
              <button
                aria-label={`Uncomplete ${t.title}`}
                onClick={() => uncomplete(t)}
                title="Mark as not done"
                className="h-5 w-5 shrink-0 rounded-md border-2 border-accent bg-accent/80 text-xs text-accent-contrast"
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-muted">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted/70">
                  {t.completed_at?.slice(0, 10)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-muted">Nothing completed yet.</p>
      )}
    </div>
  );
}
