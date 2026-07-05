// Conformance: every vector in spec/streaks/vectors.json must pass —
// the same file the Postgres compute_streak() is tested against.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeStreak, type StreakHabit } from "./streaks";

type Vector = {
  name: string;
  habit: StreakHabit;
  logs: Array<[string, number]>;
  today: string;
  week_start?: number;
  expect: { current: number; best: number; unit: "days" | "weeks" };
};

const spec = JSON.parse(
  readFileSync(join(__dirname, "../../../spec/streaks/vectors.json"), "utf8"),
) as { vectors: Vector[] };

describe("streak engine conformance", () => {
  for (const v of spec.vectors) {
    it(v.name, () => {
      expect(computeStreak(v.habit, v.logs, v.today, v.week_start ?? 1)).toEqual(
        v.expect,
      );
    });
  }
});
