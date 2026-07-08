// Habit streak engine — TypeScript implementation of spec/streaks/rules.md.
// Must stay conformant with spec/streaks/vectors.json (streaks.test.ts runs
// every vector in CI); Postgres implements the same rules in compute_streak()
// (0005) for the nightly habit_stats rollup. Client-side computation gives
// instant optimistic streaks; the server value wins on drift (recompute,
// never merge — §11.5).

export type StreakHabit = {
  type: "binary" | "quantity" | "frequency";
  schedule: { kind: "daily" } | { kind: "weekdays"; days: number[] } | { kind: "per_week" };
  target_value?: number | null;
  times_per_week?: number | null;
  pauses?: Array<{ from: string; to: string }>;
};

export type StreakResult = {
  current: number;
  best: number;
  unit: "days" | "weeks";
};

type LogPair = [string, number]; // [logged_for YYYY-MM-DD, value]

const DAY_MS = 86_400_000;

function ymdToMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function msToYmd(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function isodow(ms: number): number {
  const dow = new Date(ms).getUTCDay();
  return dow === 0 ? 7 : dow;
}

/** Start-of-week (ms) containing `ms`, weeks bounded by week_start. */
function weekOf(ms: number, weekStart: number): number {
  return ms - ((isodow(ms) - weekStart + 7) % 7) * DAY_MS;
}

function isPaused(pauses: Array<{ from: string; to: string }>, ms: number): boolean {
  return pauses.some((p) => ms >= ymdToMs(p.from) && ms <= ymdToMs(p.to));
}

function isScheduled(habit: StreakHabit, ms: number): boolean {
  return habit.schedule.kind === "weekdays"
    ? habit.schedule.days.includes(isodow(ms))
    : true;
}

export function computeStreak(
  habit: StreakHabit,
  logs: LogPair[],
  today: string,
  weekStart = 1,
): StreakResult {
  const unit: StreakResult["unit"] = habit.type === "frequency" ? "weeks" : "days";
  const pauses = habit.pauses ?? [];

  // Day-level completion: net total per logged_for reaches the threshold.
  const totals = new Map<string, number>();
  for (const [day, value] of logs) {
    totals.set(day, (totals.get(day) ?? 0) + value);
  }
  const threshold = habit.type === "quantity" ? Number(habit.target_value ?? 1) : 1;
  const completed = new Set<number>();
  for (const [day, total] of totals) {
    if (total >= threshold) completed.add(ymdToMs(day));
  }
  if (completed.size === 0) return { current: 0, best: 0, unit };

  const todayMs = ymdToMs(today);
  const minMs = Math.min(...completed);
  let current = 0;
  let best = 0;
  let run = 0;

  if (habit.type === "binary" || habit.type === "quantity") {
    // current: backward walk; an unlogged scheduled *today* is pending
    for (let d = todayMs; d >= minMs; d -= DAY_MS) {
      if (isScheduled(habit, d) && !isPaused(pauses, d)) {
        if (completed.has(d)) current++;
        else if (d !== todayMs) break;
      }
    }
    // best: forward scan with the same neutrality rules
    for (let d = minMs; d <= todayMs; d += DAY_MS) {
      if (isScheduled(habit, d) && !isPaused(pauses, d)) {
        if (completed.has(d)) {
          run++;
          best = Math.max(best, run);
        } else if (d !== todayMs) {
          run = 0;
        }
      }
    }
    return { current, best: Math.max(best, current), unit };
  }

  // frequency: weeks satisfied when completed days >= pro-rata threshold
  const timesPerWeek = Number(habit.times_per_week ?? 1);
  const todayWeek = weekOf(todayMs, weekStart);
  const firstWeek = weekOf(minMs, weekStart);

  const weekInfo = (w: number) => {
    let pausedDays = 0;
    let count = 0;
    for (let d = w; d < w + 7 * DAY_MS; d += DAY_MS) {
      if (isPaused(pauses, d)) pausedDays++;
      if (completed.has(d)) count++;
    }
    const activeDays = 7 - pausedDays;
    return {
      neutral: activeDays === 0,
      satisfied:
        activeDays > 0 && count >= Math.ceil((timesPerWeek * activeDays) / 7),
    };
  };

  for (let w = todayWeek; w >= firstWeek; w -= 7 * DAY_MS) {
    const info = weekInfo(w);
    if (info.neutral) continue;
    if (info.satisfied) current++;
    else if (w !== todayWeek) break;
  }
  for (let w = firstWeek; w <= todayWeek; w += 7 * DAY_MS) {
    const info = weekInfo(w);
    if (info.neutral) continue;
    if (info.satisfied) {
      run++;
      best = Math.max(best, run);
    } else if (w !== todayWeek) {
      run = 0;
    }
  }
  return { current, best: Math.max(best, current), unit };
}

/** Net logged total for one user-local day (compensating entries included). */
export function dayTotal(logs: LogPair[], day: string): number {
  return logs.reduce((sum, [d, v]) => (d === day ? sum + v : sum), 0);
}

export { msToYmd, ymdToMs, isScheduled, DAY_MS };
