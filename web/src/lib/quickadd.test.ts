// Conformance: every vector in spec/quick-add/vectors.json must pass.
// Behavior changes start as vector PRs (spec/README.md), never here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuickAdd, type ParseRef } from "./quickadd";

type Vector = {
  name: string;
  input: string;
  ref?: ParseRef;
  projects?: string[];
  expect: Record<string, unknown>;
  why?: string;
};

const spec = JSON.parse(
  readFileSync(join(__dirname, "../../../spec/quick-add/vectors.json"), "utf8"),
) as { default_ref: ParseRef; vectors: Vector[] };

describe("quick-add parser conformance", () => {
  for (const v of spec.vectors) {
    it(v.name, () => {
      const result = parseQuickAdd(v.input, v.ref ?? spec.default_ref, {
        knownProjects: v.projects,
      });

      const actual: Record<string, unknown> = { title: result.title };
      if (result.due_date) actual.due_date = result.due_date;
      if (result.due_time) actual.due_time = result.due_time;
      if (result.recurrence) actual.recurrence = result.recurrence;
      if (result.project) actual.project = result.project;
      if (result.labels) actual.labels = result.labels;
      if (result.priority) actual.priority = result.priority;

      expect(actual).toEqual(v.expect);
    });
  }
});
