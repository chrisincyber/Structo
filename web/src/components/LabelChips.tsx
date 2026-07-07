"use client";

// Label chips (read-only display) for task rows, and an editable label
// section for the task detail panel. Colors come from the curated project
// palette (§9.6). Labels are personal — they never leak across shared
// projects (§10.9).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { assignLabel, createLabel, nextLabelColor, unassignLabel } from "@/lib/labels";
import { fetchLabels, qk } from "@/lib/queries";
import type { Label } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/ui";

export function LabelChips({ labelIds }: { labelIds: string[] }) {
  const { data: labels } = useQuery({ queryKey: qk.labels, queryFn: fetchLabels });
  if (!labels || labelIds.length === 0) return null;
  const byId = new Map(labels.map((l) => [l.id, l]));
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {labelIds.map((id) => {
        const l = byId.get(id);
        if (!l) return null;
        return (
          <span
            key={id}
            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: PROJECT_COLORS[l.color] ?? PROJECT_COLORS.stone,
              background: `${PROJECT_COLORS[l.color] ?? PROJECT_COLORS.stone}1a`,
            }}
          >
            @{l.name}
          </span>
        );
      })}
    </span>
  );
}

export function LabelEditor({
  taskId,
  assigned,
  onChange,
}: {
  taskId: string;
  assigned: string[];
  onChange: (labelIds: string[]) => void;
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { data: labels } = useQuery({ queryKey: qk.labels, queryFn: fetchLabels });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const assignedSet = new Set(assigned);

  async function toggle(label: Label) {
    if (assignedSet.has(label.id)) {
      onChange(assigned.filter((id) => id !== label.id));
      await unassignLabel(taskId, label.id);
    } else {
      onChange([...assigned, label.id]);
      await assignLabel(taskId, label.id);
    }
    void queryClient.invalidateQueries({ queryKey: qk.taskLabelMap });
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim().replace(/^@/, "");
    if (!trimmed || !session) return;
    const color = nextLabelColor(labels ?? []);
    const { id, done } = createLabel({ owner_id: session.user.id, name: trimmed, color });
    setName("");
    setAdding(false);
    await done;
    await queryClient.invalidateQueries({ queryKey: qk.labels });
    onChange([...assigned, id]);
    await assignLabel(taskId, id);
    void queryClient.invalidateQueries({ queryKey: qk.taskLabelMap });
  }

  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        Labels
      </span>
      <div className="flex flex-wrap gap-1.5">
        {(labels ?? []).map((l) => {
          const on = assignedSet.has(l.id);
          const color = PROJECT_COLORS[l.color] ?? PROJECT_COLORS.stone;
          return (
            <button
              key={l.id}
              onClick={() => void toggle(l)}
              className="rounded-full border px-2.5 py-0.5 text-xs"
              style={
                on
                  ? { color, borderColor: color, background: `${color}1a` }
                  : { color: "var(--muted)", borderColor: "var(--hairline)" }
              }
            >
              @{l.name}
            </button>
          );
        })}
        {adding ? (
          <form onSubmit={onCreate} className="inline">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
              placeholder="new label"
              className="w-24 rounded-full border border-hairline bg-background px-2.5 py-0.5 text-xs outline-none focus:border-accent"
            />
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-hairline px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
          >
            + label
          </button>
        )}
      </div>
    </div>
  );
}
