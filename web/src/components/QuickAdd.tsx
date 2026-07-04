"use client";

// Quick capture (§3.5/§8.2): single field, natural-language parsing with
// visible chips — the parser proposes, the user confirms. Dismissing a chip
// (×) re-parses with that extraction disabled and the text stays literal.
// Composer stays open after save for rapid entry.

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createTask } from "@/lib/ops";
import { parseQuickAdd } from "@/lib/quickadd";
import { localToday } from "@/lib/queries";
import type { Task } from "@/lib/types";

const CHIP_ICON: Record<string, string> = {
  date: "📅",
  time: "⏰",
  recurrence: "↻",
  priority: "⚑",
};

export function QuickAdd({
  projectId,
  dueToday = false,
  queryKey,
}: {
  projectId: string;
  dueToday?: boolean;
  queryKey: readonly unknown[];
}) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!title.trim()) return null;
    const now = new Date();
    return parseQuickAdd(
      title,
      {
        date: localToday(),
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        week_start: 1,
      },
      {
        // Project/label pickers land later; until then #/@ stay literal text.
        disabled: new Set([...disabled, "project", "label"]),
      },
    );
  }, [title, disabled]);

  // Global "Q" focuses capture (§14.3)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key.toLowerCase() === "q" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed || !session) return;

    const dueDate = parsed.due_date ?? (dueToday ? localToday() : null);
    const recurrence = parsed.recurrence
      ? { ...parsed.recurrence, anchor: dueDate ?? undefined }
      : null;
    const recurrenceText =
      parsed.extractions.find((x) => x.kind === "recurrence")?.text ?? null;

    const { id } = createTask({
      project_id: projectId,
      author_id: session.user.id,
      title: parsed.title,
      due_date: dueDate,
      due_time: parsed.due_time ? `${parsed.due_time}:00` : null,
      recurrence,
      recurrence_text: recurrenceText,
      priority: parsed.priority ?? 4,
    });

    queryClient.setQueryData<Task[]>(queryKey, (old) => [
      ...(old ?? []),
      {
        id,
        project_id: projectId,
        section_id: null,
        parent_task_id: null,
        author_id: session.user.id,
        assignee_id: null,
        title: parsed.title,
        description: "",
        priority: (parsed.priority ?? 4) as Task["priority"],
        due_date: dueDate,
        due_time: parsed.due_time ? `${parsed.due_time}:00` : null,
        deadline_date: null,
        recurrence,
        recurrence_text: recurrenceText,
        completed_at: null,
        rank: "m",
        day_rank: "m",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);

    setTitle("");
    setDisabled(new Set());
  }

  const chips = (parsed?.extractions ?? []).filter((x) =>
    ["date", "time", "recurrence", "priority"].includes(x.kind),
  );

  return (
    <form onSubmit={onSubmit} className="mb-4">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDisabled(new Set()); // fresh text, fresh proposals
        }}
        placeholder="Add a task…  try “call mom tomorrow 5pm”  (Q)"
        className="w-full rounded-[10px] border border-hairline bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-accent"
      />
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.kind}
              type="button"
              onClick={() =>
                setDisabled((prev) => new Set([...prev, chip.kind]))
              }
              title="Remove — keeps the text in the title"
              className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
            >
              <span>{CHIP_ICON[chip.kind]}</span>
              {chip.kind === "date" && parsed?.due_date}
              {chip.kind === "time" && parsed?.due_time}
              {chip.kind === "recurrence" && chip.text}
              {chip.kind === "priority" && chip.text.toUpperCase()}
              <span className="text-accent/60">×</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
