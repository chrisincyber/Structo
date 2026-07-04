"use client";

// Today (§11.3): overdue folded in, habits band above tasks, never interleaved.

import { useQuery } from "@tanstack/react-query";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskRow } from "@/components/TaskRow";
import {
  fetchHabitLogsToday,
  fetchHabits,
  fetchInboxProjectId,
  fetchTasksToday,
  localToday,
  qk,
} from "@/lib/queries";
import { HabitsBand } from "@/components/HabitsBand";

export default function TodayPage() {
  const tasks = useQuery({ queryKey: qk.tasksToday, queryFn: fetchTasksToday });
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({ queryKey: qk.habitLogsToday, queryFn: fetchHabitLogsToday });
  const inbox = useQuery({ queryKey: ["projects", "inbox-id"], queryFn: fetchInboxProjectId });

  const today = localToday();
  const overdue = (tasks.data ?? []).filter((t) => t.due_date! < today);
  const dueToday = (tasks.data ?? []).filter((t) => t.due_date! >= today);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Today</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">
        {dueToday.length} task{dueToday.length === 1 ? "" : "s"}
        {overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}
        {habits.data?.length ? ` · ${habits.data.length} habits` : ""}
      </p>

      {habits.data && habits.data.length > 0 && (
        <HabitsBand habits={habits.data} logs={logs.data ?? []} />
      )}

      {inbox.data && (
        <QuickAdd projectId={inbox.data} dueToday queryKey={qk.tasksToday} />
      )}

      {tasks.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                Overdue ({overdue.length})
              </h2>
              <ul>{overdue.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
            </section>
          )}
          {dueToday.length > 0 ? (
            <ul>{dueToday.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
          ) : (
            overdue.length === 0 && (
              <p className="py-8 text-center text-muted">Nothing due today.</p>
            )
          )}
        </>
      )}
    </div>
  );
}
