"use client";

// Project view (§3.1): tasks grouped by section. An "unsectioned" group holds
// tasks with no section; each section is a titled group. Sections are created
// inline and tasks move between them from the task detail panel (V1.1) or the
// section header menu here.

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskRow } from "@/components/TaskRow";
import { useAuth } from "@/lib/auth";
import { dispatch } from "@/lib/ops";
import { fetchProject, fetchSections, fetchTasksByProject, qk } from "@/lib/queries";
import type { Section, Task } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/ui";
import { uuidv7 } from "@/lib/uuid";

function SectionGroup({
  section,
  tasks,
  sections,
  onMove,
}: {
  section: Section | null;
  tasks: Task[];
  sections: Section[];
  onMove: (task: Task, sectionId: string | null) => void;
}) {
  const list = tasks.filter((t) => (t.section_id ?? null) === (section?.id ?? null));
  return (
    <section className="mb-5">
      {section && (
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
          {section.name}
        </h2>
      )}
      {list.length > 0 ? (
        <ul>
          {list.map((t) => (
            <div key={t.id} className="group relative">
              <TaskRow task={t} />
              <select
                aria-label="Move task to section"
                value={section?.id ?? ""}
                onChange={(e) => onMove(t, e.target.value || null)}
                className="absolute right-0 top-3 rounded-md border border-hairline bg-card px-1 py-0.5 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100"
              >
                <option value="">No section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </ul>
      ) : section ? (
        <p className="py-1 text-sm text-muted/60">No tasks.</p>
      ) : null}
    </section>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const project = useQuery({
    queryKey: ["projects", "detail", id],
    queryFn: () => fetchProject(id),
  });
  const tasks = useQuery({ queryKey: qk.tasksProject(id), queryFn: () => fetchTasksByProject(id) });
  const sections = useQuery({ queryKey: qk.sections(id), queryFn: () => fetchSections(id) });

  const [addingSection, setAddingSection] = useState(false);
  const [sectionName, setSectionName] = useState("");

  function createSection(e: React.FormEvent) {
    e.preventDefault();
    const name = sectionName.trim();
    if (!name || !session) return;
    const sid = uuidv7();
    const row: Section = {
      id: sid,
      project_id: id,
      name,
      rank: "m",
      is_archived: false,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    queryClient.setQueryData<Section[]>(qk.sections(id), (old) => [...(old ?? []), row]);
    void dispatch({
      op_id: uuidv7(),
      verb: "upsert",
      table: "sections",
      row: { id: sid, project_id: id, name },
    });
    setSectionName("");
    setAddingSection(false);
  }

  function moveTask(task: Task, sectionId: string | null) {
    queryClient.setQueryData<Task[]>(qk.tasksProject(id), (old) =>
      old?.map((t) => (t.id === task.id ? { ...t, section_id: sectionId } : t)),
    );
    void dispatch({
      op_id: uuidv7(),
      verb: "upsert",
      table: "tasks",
      row: { id: task.id, section_id: sectionId },
    });
  }

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
      ) : (
        <>
          <SectionGroup
            section={null}
            tasks={tasks.data ?? []}
            sections={sections.data ?? []}
            onMove={moveTask}
          />
          {(sections.data ?? []).map((s) => (
            <SectionGroup
              key={s.id}
              section={s}
              tasks={tasks.data ?? []}
              sections={sections.data ?? []}
              onMove={moveTask}
            />
          ))}
          {(tasks.data?.length ?? 0) === 0 && (sections.data?.length ?? 0) === 0 && (
            <p className="py-8 text-center text-muted">No open tasks.</p>
          )}
        </>
      )}

      {addingSection ? (
        <form onSubmit={createSection} className="mt-2">
          <input
            autoFocus
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAddingSection(false)}
            placeholder="Section name"
            className="w-full rounded-[10px] border border-hairline bg-card px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </form>
      ) : (
        <button
          onClick={() => setAddingSection(true)}
          className="mt-2 text-sm text-muted hover:text-accent"
        >
          + Add section
        </button>
      )}
    </div>
  );
}
