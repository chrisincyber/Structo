"use client";

// Habit detail (§8.7): streaks + a 10-week history calendar with tap-to-
// backfill (§5.4: backfill is MVP — a missed log entry must be repairable).
// Binary days toggle; quantity days step +1 (with −1 for corrections via
// compensating entries). Misses are quiet gray — no red, no shame (§5.6).

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { deleteRow, logHabit, updateRow } from "@/lib/ops";
import { localToday } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import {
  computeStreak,
  dayTotal,
  DAY_MS,
  isScheduled,
  msToYmd,
  ymdToMs,
} from "@/lib/streaks";
import type { Habit, HabitLog } from "@/lib/types";

const WEEKS_SHOWN = 10;

async function fetchHabit(id: string): Promise<Habit> {
  const { data, error } = await supabase().from("habits").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Habit;
}

async function fetchLogs(habitId: string): Promise<HabitLog[]> {
  const { data, error } = await supabase()
    .from("habit_logs")
    .select("*")
    .eq("habit_id", habitId)
    .is("deleted_at", null)
    .order("logged_for");
  if (error) throw error;
  return data as HabitLog[];
}

export default function HabitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const habit = useQuery({ queryKey: ["habits", "detail", id], queryFn: () => fetchHabit(id) });
  const logs = useQuery({ queryKey: ["habit_logs", "habit", id], queryFn: () => fetchLogs(id) });

  const today = localToday();
  const pairs = (logs.data ?? []).map(
    (l) => [l.logged_for, Number(l.value)] as [string, number],
  );
  const streak = habit.data
    ? computeStreak(
        {
          ...habit.data,
          pauses:
            habit.data.is_paused && habit.data.paused_at
              ? [{ from: habit.data.paused_at.slice(0, 10), to: today }]
              : [],
        },
        pairs,
        today,
      )
    : null;

  function log(day: string, value: number) {
    if (!session) return;
    queryClient.setQueryData<HabitLog[]>(["habit_logs", "habit", id], (old) => [
      ...(old ?? []),
      {
        id: crypto.randomUUID(),
        habit_id: id,
        user_id: session.user.id,
        logged_for: day,
        value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);
    void logHabit({ habit_id: id, user_id: session.user.id, logged_for: day, value });
    void queryClient.invalidateQueries({ queryKey: ["habit_logs", "today"] });
  }

  function onDayTap(day: string) {
    if (!habit.data || day > today) return;
    const total = dayTotal(pairs, day);
    if (habit.data.type === "quantity") {
      log(day, 1);
    } else if (total >= 1) {
      log(day, -1); // un-log via compensating entry (history stays append-only)
    } else {
      log(day, 1);
    }
  }

  // Calendar: WEEKS_SHOWN weeks ending with the current week (Monday start)
  const todayMs = ymdToMs(today);
  const currentMonday = todayMs - ((new Date(todayMs).getUTCDay() + 6) % 7) * DAY_MS;
  const start = currentMonday - (WEEKS_SHOWN - 1) * 7 * DAY_MS;
  const weeks: string[][] = [];
  for (let w = 0; w < WEEKS_SHOWN; w++) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => msToYmd(start + (w * 7 + i) * DAY_MS)),
    );
  }
  const target = Number(habit.data?.target_value ?? 1);
  const threshold = habit.data?.type === "quantity" ? target : 1;

  return (
    <div>
      {!habit.data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{habit.data.name}</h1>
              <p className="mt-0.5 text-sm text-muted">
                {habit.data.type === "quantity" &&
                  `${target} ${habit.data.unit ?? ""} per day`}
                {habit.data.type === "frequency" &&
                  `${habit.data.times_per_week}× per week`}
                {habit.data.type === "binary" &&
                  (habit.data.schedule.kind === "weekdays"
                    ? "On scheduled days"
                    : "Every day")}
                {habit.data.is_paused && " · paused"}
              </p>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <p className="text-xl font-bold text-accent">
                  {streak?.current ?? 0}
                </p>
                <p className="text-xs text-muted">current {streak?.unit}</p>
              </div>
              <div>
                <p className="text-xl font-bold">{streak?.best ?? 0}</p>
                <p className="text-xs text-muted">best {streak?.unit}</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Last {WEEKS_SHOWN} weeks — tap a day to log or fix
            </h2>
            <div className="space-y-1">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex gap-1">
                  {week.map((day) => {
                    const total = dayTotal(pairs, day);
                    const done = total >= threshold;
                    const partial = total > 0 && !done;
                    const future = day > today;
                    const scheduled = isScheduled(habit.data!, ymdToMs(day));
                    return (
                      <button
                        key={day}
                        disabled={future}
                        onClick={() => onDayTap(day)}
                        title={`${day}${total > 0 ? ` · ${total}` : ""}`}
                        className={`h-7 w-7 rounded-md text-[10px] transition-colors ${
                          future
                            ? "bg-transparent"
                            : done
                              ? "bg-accent text-accent-contrast"
                              : partial
                                ? "bg-accent/30"
                                : scheduled
                                  ? "bg-hairline"
                                  : "bg-hairline/40"
                        } ${day === today ? "ring-2 ring-accent/50" : ""}`}
                      >
                        {new Date(ymdToMs(day)).getUTCDate()}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {habit.data.type === "quantity" && (
            <div className="mt-6 flex items-center gap-3">
              <span className="text-sm text-muted">
                Today: {dayTotal(pairs, today)}/{target} {habit.data.unit ?? ""}
              </span>
              <button
                onClick={() => log(today, 1)}
                className="rounded-[10px] bg-accent px-3 py-1 text-sm font-medium text-accent-contrast"
              >
                +1
              </button>
              <button
                onClick={() => dayTotal(pairs, today) > 0 && log(today, -1)}
                className="rounded-[10px] border border-hairline px-3 py-1 text-sm text-muted"
              >
                −1
              </button>
            </div>
          )}

          <div className="mt-10 flex gap-4 border-t border-hairline pt-4">
            <button
              onClick={() => {
                void updateRow("habits", id, {
                  is_paused: !habit.data!.is_paused,
                  paused_at: habit.data!.is_paused ? null : new Date().toISOString(),
                });
                void queryClient.invalidateQueries({ queryKey: ["habits"] });
              }}
              className="text-sm text-muted hover:underline"
            >
              {habit.data.is_paused ? "Resume habit" : "Pause habit"}
            </button>
            <button
              onClick={() => {
                void deleteRow("habits", id);
                void queryClient.invalidateQueries({ queryKey: ["habits"] });
                router.push("/habits");
              }}
              className="text-sm text-p1 hover:underline"
            >
              Delete habit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
