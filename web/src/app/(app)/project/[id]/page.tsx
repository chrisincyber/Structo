"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskRow } from "@/components/TaskRow";
import { fetchProject, fetchTasksByProject, qk } from "@/lib/queries";
import { PROJECT_COLORS } from "@/lib/ui";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const project = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => fetchProject(id),
  });
  const tasks = useQuery({
    queryKey: qk.tasksProject(id),
    queryFn: () => fetchTasksByProject(id),
  });

  return (
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: PROJECT_COLORS[project.data?.color ?? "stone"] }}
        />
        {project.data?.name ?? "…"}
      </h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">
        {tasks.data?.length ?? 0} open task{tasks.data?.length === 1 ? "" : "s"}
      </p>

      <QuickAdd projectId={id} queryKey={qk.tasksProject(id)} />

      {tasks.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : tasks.data && tasks.data.length > 0 ? (
        <ul>{tasks.data.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
      ) : (
        <p className="py-8 text-center text-muted">No open tasks.</p>
      )}
    </div>
  );
}
