"use client";

// Weekly Review (§5.9) — the retention ritual. Choreography over existing
// verbs: a habit scorecard for the week, tasks-completed count, and one-swipe
// overdue triage. Three minutes, calm, no shame (§5.6): a missed habit is a
// quiet number, never red.

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { completeTask, updateRow } from "@/lib/ops";
import {
  countCompletedSince,
  fetchHabitLogsSince,
  fetchHabits,
  fetchOverdueTasks,
  fetchTasksInbox,
  localToday,
  qk,
} from "@/lib/queries";
import { DAY_MS, dayTotal, isScheduled, msToYmd, ymdToMs } from "@/lib/streaks";
import type { Habit, HabitLog, Task } from "@/lib/types";

function weekStartYmd(today: string, weekStart = 1): string {
  const ms = ymdToMs(today);
  const dow = new Date(ms).getUTCDay() === 0 ? 7 : new Date(ms).getUTCDay();
  return msToYmd(ms - ((dow - weekStart + 7) % 7) * DAY_MS);
}

function scheduledDaysThisWeek(habit: Habit, weekStart: string, today: string): number {
  let count = 0;
  for (let d = ymdToMs(weekStart); d <= ymdToMs(today); d += DAY_MS) {
    if (isScheduled(habit, d)) count++;
  }
  return count;
}

function completedDaysThisWeek(
  habit: Habit,
  logs: HabitLog[],
  weekStart: string,
  today: string,
): number {
  const pairs = logs
    .filter((l) => l.habit_id === habit.id)
    .map((l) => [l.logged_for, Number(l.value)] as [string, number]);
  const threshold = habit.type === "quantity" ? Number(habit.target_value ?? 1) : 1;
  let count = 0;
  for (let d = ymdToMs(weekStart); d <= ymdToMs(today); d += DAY_MS) {
    if (dayTotal(pairs, msToYmd(d)) >= threshold) count++;
  }
  return count;
}

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const today = localToday();
  const weekStart = weekStartYmd(today);

  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({
    queryKey: ["habit_logs", "since", weekStart],
    queryFn: () => fetchHabitLogsSince(weekStart),
  });
  const overdue = useQuery({ queryKey: ["tasks", "overdue"], queryFn: fetchOverdueTasks });
  const inbox = useQuery({ queryKey: qk.tasksInbox, queryFn: fetchTasksInbox });
  const completed = useQuery({
    queryKey: ["tasks", "completed-count", weekStart],
    queryFn: () => countCompletedSince(weekStart),
  });

  function reschedule(task: Task, to: "today" | "tomorrow" | null) {
    const date =
      to === null
        ? null
        : to === "today"
          ? today
          : msToYmd(ymdToMs(today) + DAY_MS);
    queryClient.setQueryData<Task[]>(["tasks", "overdue"], (old) =>
      old?.filter((t) => t.id !== task.id),
    );
    void updateRow("tasks", task.id, { due_date: date });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  function complete(task: Task) {
    queryClient.setQueryData<Task[]>(["tasks", "overdue"], (old) =>
      old?.filter((t) => t.id !== task.id),
    );
    void completeTask(task.id);
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const weekLabel = new Date(ymdToMs(weekStart)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Weekly review</h1>
      <p className="mt-0.5 mb-8 text-sm text-muted">Week of {weekLabel} · three calm minutes</p>

      {/* 1. Habit scorecard */}
      <section className="mb-8">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Habits this week
        </h2>
        {habits.data && habits.data.length > 0 ? (
          <ul className="space-y-2">
            {habits.data.map((h) => {
              const done = completedDaysThisWeek(h, logs.data ?? [], weekStart, today);
              const scheduled =
                h.type === "frequency"
                  ? Number(h.times_per_week ?? 0)
                  : scheduledDaysThisWeek(h, weekStart, today);
              const pct = scheduled > 0 ? Math.round((done / scheduled) * 100) : 0;
              return (
                <li key={h.id} className="flex items-center gap-3">
                  <span className="w-32 truncate text-[15px]">{h.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm text-muted tabular-nums">
                    {done} of {scheduled}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No habits yet.</p>
        )}
      </section>

      {/* 2. Tasks completed */}
      <section className="mb-8">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Done this week
        </h2>
        <p className="text-[15px]">
          <span className="text-xl font-bold text-accent tabular-nums">
            {completed.data ?? 0}
          </span>{" "}
          task{completed.data === 1 ? "" : "s"} completed.
        </p>
      </section>

      {/* 3. Overdue triage */}
      <section className="mb-8">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Overdue ({overdue.data?.length ?? 0})
        </h2>
        {overdue.data && overdue.data.length > 0 ? (
          <ul className="space-y-2">
            {overdue.data.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 border-b border-hairline py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {t.title}
                  <span className="ml-2 text-xs text-muted">{t.due_date}</span>
                </span>
                <button
                  onClick={() => reschedule(t, "today")}
                  className="rounded-md px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
                >
                  Today
                </button>
                <button
                  onClick={() => reschedule(t, "tomorrow")}
                  className="rounded-md px-2 py-0.5 text-xs text-muted hover:bg-hairline/50"
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => complete(t)}
                  className="rounded-md px-2 py-0.5 text-xs text-muted hover:bg-hairline/50"
                >
                  Done
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing overdue. Clean slate.</p>
        )}
      </section>

      {/* 4. Inbox + week glance */}
      <section className="mb-4">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Next week
        </h2>
        <div className="flex gap-3">
          <Link
            href="/inbox"
            className="rounded-[10px] border border-hairline px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            Process inbox ({inbox.data?.length ?? 0})
          </Link>
          <Link
            href="/upcoming"
            className="rounded-[10px] border border-hairline px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            Plan upcoming →
          </Link>
        </div>
      </section>
    </div>
  );
}
