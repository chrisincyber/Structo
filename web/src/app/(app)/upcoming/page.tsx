"use client";

// Upcoming (§11.3): day-grouped scroll starting tomorrow; recurring tasks
// render only their next occurrence. Rescheduling happens via the task
// detail panel (drag-to-day lands with the dnd milestone).

import { useQuery } from "@tanstack/react-query";
import { TaskRow } from "@/components/TaskRow";
import { supabase } from "@/lib/supabase";
import { localToday } from "@/lib/queries";
import type { Task } from "@/lib/types";

const DAYS_AHEAD = 14;

async function fetchTasksUpcoming(): Promise<Task[]> {
  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .is("completed_at", null)
    .gt("due_date", localToday())
    .order("due_date")
    .order("day_rank");
  if (error) throw error;
  return data as Task[];
}

function dayLabel(ymd: string, today: string): string {
  const diff =
    (Date.parse(ymd + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000;
  if (diff === 1) return "Tomorrow";
  const d = new Date(ymd + "T00:00:00Z");
  const weekday = d.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return diff < 7 ? `${weekday} · ${date}` : date;
}

export default function UpcomingPage() {
  const tasks = useQuery({ queryKey: ["tasks", "upcoming"], queryFn: fetchTasksUpcoming });
  const today = localToday();

  // Group by due_date, keep day order; days beyond the horizon collapse
  // into a single "Later" group.
  const groups = new Map<string, Task[]>();
  const horizon = new Date(Date.parse(today + "T00:00:00Z") + DAYS_AHEAD * 86_400_000)
    .toISOString()
    .slice(0, 10);
  for (const t of tasks.data ?? []) {
    const key = t.due_date! <= horizon ? t.due_date! : "later";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Upcoming</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">
        {tasks.data?.length ?? 0} scheduled task{tasks.data?.length === 1 ? "" : "s"}
      </p>

      {tasks.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : groups.size === 0 ? (
        <p className="py-8 text-center text-muted">Nothing scheduled yet.</p>
      ) : (
        [...groups.entries()].map(([day, dayTasks]) => (
          <section key={day} className="mb-5">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
              {day === "later" ? "Later" : dayLabel(day, today)}
            </h2>
            <ul>{dayTasks.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          </section>
        ))
      )}
    </div>
  );
}
