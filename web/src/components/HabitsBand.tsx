"use client";

// Habits band (§5.7): a distinct chip row above the task list — habits and
// tasks are never interleaved. One tap logs binary; quantity steps +1.
// Chips use the ring/circle token (tasks use squares) — §9.10.

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { logHabit } from "@/lib/ops";
import { localToday, qk } from "@/lib/queries";
import type { Habit, HabitLog } from "@/lib/types";
import { uuidv7 } from "@/lib/uuid";

export function HabitsBand({ habits, logs }: { habits: Habit[]; logs: HabitLog[] }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  function totalFor(habitId: string): number {
    return logs
      .filter((l) => l.habit_id === habitId)
      .reduce((sum, l) => sum + Number(l.value), 0);
  }

  function isDone(h: Habit): boolean {
    const total = totalFor(h.id);
    return h.type === "quantity" ? total >= Number(h.target_value) : total >= 1;
  }

  async function onLog(h: Habit) {
    if (!session) return;
    if (h.type !== "quantity" && isDone(h)) return; // binary: tap again = no-op (undo lives in detail)

    const today = localToday();
    // Optimistic log entry
    queryClient.setQueryData<HabitLog[]>(qk.habitLogsToday, (old) => [
      ...(old ?? []),
      {
        id: uuidv7(),
        habit_id: h.id,
        user_id: session.user.id,
        logged_for: today,
        value: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);
    await logHabit({
      habit_id: h.id,
      user_id: session.user.id,
      logged_for: today,
      value: 1,
    });
  }

  const allDone = habits.every(isDone);

  if (allDone) {
    return (
      <p className="mb-4 border-b border-hairline pb-3 text-sm text-muted">
        All habits done ✓
      </p>
    );
  }

  return (
    <div className="mb-5 flex flex-wrap gap-2 border-b border-hairline pb-4">
      {habits.map((h) => {
        const done = isDone(h);
        const total = totalFor(h.id);
        return (
          <button
            key={h.id}
            onClick={() => void onLog(h)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              done
                ? "border-accent bg-accent/10 text-accent"
                : "border-hairline bg-card hover:border-accent"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-full border-2 ${
                done ? "border-accent bg-accent" : "border-muted"
              }`}
            />
            {h.name}
            {h.type === "quantity" && (
              <span className="text-xs text-muted">
                {total}/{Number(h.target_value)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
