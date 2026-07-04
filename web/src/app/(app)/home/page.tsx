"use client";

// Home (§6): the widget dashboard. First cut renders the default layout's
// content directly (Today peek + Habits band); the widget registry, edit mode,
// and gallery land in milestone M5.

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HabitsBand } from "@/components/HabitsBand";
import {
  fetchHabitLogsToday,
  fetchHabits,
  fetchTasksToday,
  qk,
} from "@/lib/queries";

export default function HomePage() {
  const tasks = useQuery({ queryKey: qk.tasksToday, queryFn: fetchTasksToday });
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({ queryKey: qk.habitLogsToday, queryFn: fetchHabitLogsToday });

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{dateLabel}</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        {tasks.data?.length ?? 0} tasks · {habits.data?.length ?? 0} habits
      </p>

      <div className="space-y-4">
        <section className="rounded-[16px] border border-hairline bg-card p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Today
          </h2>
          {tasks.data && tasks.data.length > 0 ? (
            <ul className="space-y-1.5">
              {tasks.data.slice(0, 5).map((t) => (
                <li key={t.id} className="truncate text-[15px]">
                  {t.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing due.</p>
          )}
          {(tasks.data?.length ?? 0) > 5 && (
            <Link href="/today" className="mt-2 block text-sm text-accent">
              +{tasks.data!.length - 5} more →
            </Link>
          )}
        </section>

        <section className="rounded-[16px] border border-hairline bg-card p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Habits
          </h2>
          {habits.data && habits.data.length > 0 ? (
            <HabitsBand habits={habits.data} logs={logs.data ?? []} />
          ) : (
            <p className="text-sm text-muted">No habits yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
