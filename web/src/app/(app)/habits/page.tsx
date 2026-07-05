"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HabitsBand } from "@/components/HabitsBand";
import { NewHabit } from "@/components/NewHabit";
import { fetchHabitLogsToday, fetchHabits, qk } from "@/lib/queries";

export default function HabitsPage() {
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({ queryKey: qk.habitLogsToday, queryFn: fetchHabitLogsToday });
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
          <p className="mt-0.5 mb-6 text-sm text-muted">
            What you sustain, not what you owe.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-[10px] bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast"
          >
            + New habit
          </button>
        )}
      </div>

      {creating && <NewHabit onClose={() => setCreating(false)} />}

      {habits.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : habits.data && habits.data.length > 0 ? (
        <HabitsBand habits={habits.data} logs={logs.data ?? []} />
      ) : (
        !creating && (
          <p className="py-8 text-center text-muted">
            No habits yet — create your first one.
          </p>
        )
      )}
    </div>
  );
}
