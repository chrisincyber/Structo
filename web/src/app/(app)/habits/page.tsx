"use client";

import Link from "next/link";
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
        <>
          <HabitsBand habits={habits.data} logs={logs.data ?? []} />
          <ul className="mt-2">
            {habits.data.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/habit/${h.id}`}
                  className="flex items-center justify-between border-b border-hairline py-3 hover:bg-hairline/30"
                >
                  <span className="text-[15px]">{h.name}</span>
                  <span className="text-sm text-muted">
                    {h.is_paused
                      ? "paused"
                      : h.type === "frequency"
                        ? `${h.times_per_week}×/week`
                        : h.type === "quantity"
                          ? `${Number(h.target_value)} ${h.unit ?? ""}/day`
                          : "daily"}{" "}
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
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
