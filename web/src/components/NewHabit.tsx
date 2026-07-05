"use client";

// Habit creation (§8.6): plain-language type choice, schedule, sensible
// defaults everywhere — tapping through makes a valid daily binary habit.
// Type is immutable after creation (enforced by a DB trigger too).

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { dispatch } from "@/lib/ops";
import { qk } from "@/lib/queries";
import type { Habit } from "@/lib/types";
import { uuidv7 } from "@/lib/uuid";

const TYPES = [
  { value: "binary", label: "Done or not", hint: "e.g. Read, Meditate" },
  { value: "quantity", label: "An amount", hint: "e.g. 8 glasses of water" },
  { value: "frequency", label: "X times a week", hint: "e.g. Workout 3×" },
] as const;

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]; // ISO 1..7

export function NewHabit({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("binary");
  const [target, setTarget] = useState(8);
  const [unit, setUnit] = useState("glasses");
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [scheduleKind, setScheduleKind] = useState<"daily" | "weekdays">("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !session) return;

    const schedule =
      type === "frequency"
        ? { kind: "per_week" as const }
        : scheduleKind === "weekdays"
          ? { kind: "weekdays" as const, days: [...days].sort((a, b) => a - b) }
          : { kind: "daily" as const };

    const id = uuidv7();
    const row: Record<string, unknown> = {
      id,
      owner_id: session.user.id,
      name: trimmed,
      type,
      schedule,
    };
    if (type === "quantity") {
      row.target_value = target;
      row.unit = unit.trim() || null;
    }
    if (type === "frequency") row.times_per_week = timesPerWeek;

    queryClient.setQueryData<Habit[]>(qk.habits, (old) => [
      ...(old ?? []),
      {
        id,
        owner_id: session.user.id,
        name: trimmed,
        icon: "circle",
        color: null,
        type,
        target_value: type === "quantity" ? target : null,
        unit: type === "quantity" ? unit : null,
        times_per_week: type === "frequency" ? timesPerWeek : null,
        schedule,
        reminder_time: null,
        rank: "m",
        is_paused: false,
        archived_at: null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);
    void dispatch({ op_id: uuidv7(), verb: "upsert", table: "habits", row });
    onClose();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-4 rounded-[16px] border border-hairline bg-card p-4"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Habit name (e.g. Drink water)"
        className="w-full rounded-[10px] border border-hairline bg-background px-3 py-2 text-[15px] outline-none focus:border-accent"
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
          How do you track it?
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              title={t.hint}
              className={`rounded-[10px] border px-3 py-1.5 text-sm ${
                type === t.value
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-hairline"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {type === "quantity" && (
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Daily target
            </span>
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-20 rounded-[10px] border border-hairline bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Unit
            </span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="glasses"
              className="w-full rounded-[10px] border border-hairline bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
      )}

      {type === "frequency" && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Times per week
          </span>
          <input
            type="number"
            min={1}
            max={7}
            value={timesPerWeek}
            onChange={(e) => setTimesPerWeek(Number(e.target.value))}
            className="w-20 rounded-[10px] border border-hairline bg-background px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
      )}

      {type !== "frequency" && (
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
            Schedule
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScheduleKind("daily")}
              className={`rounded-[10px] border px-3 py-1.5 text-sm ${
                scheduleKind === "daily"
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-hairline"
              }`}
            >
              Every day
            </button>
            <button
              type="button"
              onClick={() => setScheduleKind("weekdays")}
              className={`rounded-[10px] border px-3 py-1.5 text-sm ${
                scheduleKind === "weekdays"
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-hairline"
              }`}
            >
              Specific days
            </button>
            {scheduleKind === "weekdays" &&
              WEEKDAY_LABELS.map((label, i) => {
                const day = i + 1;
                const on = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setDays((prev) =>
                        on ? prev.filter((d) => d !== day) : [...prev, day],
                      )
                    }
                    className={`h-7 w-7 rounded-full border text-xs ${
                      on
                        ? "border-accent bg-accent text-accent-contrast"
                        : "border-hairline text-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-[10px] bg-accent px-4 py-1.5 text-sm font-medium text-accent-contrast"
        >
          Create habit
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-[10px] px-3 py-1.5 text-sm text-muted hover:bg-hairline/50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
