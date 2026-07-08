"use client";

// Label view (§3.6): all open tasks carrying one label, a built-in saved
// view. Labels are cross-project (§10.9) so this pulls from every project the
// user can see.

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { TaskRow } from "@/components/TaskRow";
import { fetchLabel, fetchTasksByLabel, qk } from "@/lib/queries";
import { PROJECT_COLORS } from "@/lib/ui";

export default function LabelPage() {
  const { id } = useParams<{ id: string }>();
  const label = useQuery({ queryKey: ["labels", "detail", id], queryFn: () => fetchLabel(id) });
  const tasks = useQuery({ queryKey: qk.tasksLabel(id), queryFn: () => fetchTasksByLabel(id) });

  const color = PROJECT_COLORS[label.data?.color ?? "stone"] ?? PROJECT_COLORS.stone;

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <span style={{ color }}>@{label.data?.name ?? "…"}</span>
      </h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">
        {tasks.data?.length ?? 0} task{tasks.data?.length === 1 ? "" : "s"} with this label
      </p>

      {tasks.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : tasks.data && tasks.data.length > 0 ? (
        <ul>{tasks.data.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
      ) : (
        <p className="py-8 text-center text-muted">No tasks with this label.</p>
      )}
    </div>
  );
}
