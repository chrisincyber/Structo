"use client";

// Task row (§9.4: rows with hairline separators, never card-per-task).
// Completion is optimistic: the row leaves the list instantly, the op flows
// through the mutations funnel, recurring tasks roll server-side.

import { useQueryClient } from "@tanstack/react-query";
import { completeTask } from "@/lib/ops";
import type { Task } from "@/lib/types";

const PRIORITY_COLOR: Record<number, string> = {
  1: "border-p1",
  2: "border-p2",
  3: "border-p3",
  4: "border-muted/40",
};

export function TaskRow({ task }: { task: Task }) {
  const queryClient = useQueryClient();

  async function onComplete() {
    // Optimistic removal from every task list containing it
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
      old?.filter((t) => t.id !== task.id),
    );
    await completeTask(task.id);
    // Recurring tasks roll to a new date server-side; refetch to pick that up
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  return (
    <li className="flex items-center gap-3 border-b border-hairline py-3">
      <button
        aria-label={`Complete ${task.title}`}
        onClick={onComplete}
        className={`h-5 w-5 shrink-0 rounded-md border-2 ${PRIORITY_COLOR[task.priority]} transition-colors hover:bg-accent/20`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px]">{task.title}</p>
        {(task.due_date || task.recurrence_text) && (
          <p className="mt-0.5 text-xs text-muted">
            {task.due_date}
            {task.due_time ? ` · ${task.due_time.slice(0, 5)}` : ""}
            {task.recurrence_text ? ` · ↻ ${task.recurrence_text}` : ""}
          </p>
        )}
      </div>
    </li>
  );
}
