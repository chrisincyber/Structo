"use client";

// Task detail — right-side slide-over panel (§7.2: the list stays visible).
// Field edits save on change through the mutations funnel with optimistic
// cache updates across every task list. Delete tombstones with an undo window
// handled server-side (30-day trash).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteRow, updateRow } from "@/lib/ops";
import { fetchTaskById } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { useUi } from "@/lib/ui";

const PRIORITIES = [
  { value: 1, label: "P1", cls: "text-p1 border-p1" },
  { value: 2, label: "P2", cls: "text-p2 border-p2" },
  { value: 3, label: "P3", cls: "text-p3 border-p3" },
  { value: 4, label: "P4", cls: "text-muted border-hairline" },
] as const;

export function TaskDetail() {
  const { openTaskId, closeTask } = useUi();
  const queryClient = useQueryClient();

  const { data: task } = useQuery({
    queryKey: ["tasks", "detail", openTaskId],
    queryFn: () => fetchTaskById(openTaskId!),
    enabled: Boolean(openTaskId),
  });

  if (!openTaskId) return null;

  function patch(fields: Partial<Task>) {
    if (!task) return;
    // Optimistic: update the detail cache and every list containing the task
    queryClient.setQueryData<Task | null>(["tasks", "detail", task.id], {
      ...task,
      ...fields,
    });
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
      Array.isArray(old)
        ? old.map((t) => (t.id === task.id ? { ...t, ...fields } : t))
        : old,
    );
    void updateRow("tasks", task.id, fields);
  }

  function onDelete() {
    if (!task) return;
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
      Array.isArray(old) ? old.filter((t) => t.id !== task.id) : old,
    );
    void deleteRow("tasks", task.id);
    closeTask();
  }

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={closeTask}
        className="flex-1 bg-black/20"
      />
      <div className="flex w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-hairline bg-card p-6 shadow-xl">
        {!task ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <>
            <input
              defaultValue={task.title}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== task.title) patch({ title: v });
              }}
              className="w-full bg-transparent text-lg font-semibold outline-none"
            />

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Description
              </span>
              <textarea
                defaultValue={task.description}
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== task.description)
                    patch({ description: e.target.value });
                }}
                className="w-full resize-none rounded-[10px] border border-hairline bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>

            <div className="flex gap-3">
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                  Due date
                </span>
                <input
                  type="date"
                  value={task.due_date ?? ""}
                  onChange={(e) => patch({ due_date: e.target.value || null })}
                  className="w-full rounded-[10px] border border-hairline bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                  Time
                </span>
                <input
                  type="time"
                  value={task.due_time?.slice(0, 5) ?? ""}
                  disabled={!task.due_date}
                  onChange={(e) =>
                    patch({ due_time: e.target.value ? `${e.target.value}:00` : null })
                  }
                  className="w-full rounded-[10px] border border-hairline bg-background px-3 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
                />
              </label>
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                Priority
              </span>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => patch({ priority: p.value })}
                    className={`rounded-[10px] border px-3 py-1 text-sm ${p.cls} ${
                      task.priority === p.value ? "bg-accent/10 font-semibold" : ""
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {task.recurrence_text && (
              <p className="text-sm text-muted">↻ {task.recurrence_text}</p>
            )}

            <button
              onClick={onDelete}
              className="mt-auto self-start text-sm text-p1 hover:underline"
            >
              Delete task
            </button>
          </>
        )}
      </div>
    </div>
  );
}
