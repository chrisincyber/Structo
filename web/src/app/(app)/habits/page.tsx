"use client";

import { useQuery } from "@tanstack/react-query";
import { HabitsBand } from "@/components/HabitsBand";
import { fetchHabitLogsToday, fetchHabits, qk } from "@/lib/queries";

export default function HabitsPage() {
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({ queryKey: qk.habitLogsToday, queryFn: fetchHabitLogsToday });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">
        What you sustain, not what you owe.
      </p>

      {habits.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : habits.data && habits.data.length > 0 ? (
        <HabitsBand habits={habits.data} logs={logs.data ?? []} />
      ) : (
        <p className="py-8 text-center text-muted">
          No habits yet. Creation UI lands with the next milestone.
        </p>
      )}
    </div>
  );
}
