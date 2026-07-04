"use client";

// Quick capture (§3.5, first cut): plain-title capture into a target project,
// optimistic insert, composer stays open for rapid entry (§8.2). The NL date
// parser (spec/quick-add) plugs into this input in a later milestone.

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { createTask } from "@/lib/ops";
import type { Task } from "@/lib/types";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // Global "Q" opens capture (§14.3 shortcuts)
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
    const trimmed = title.trim();
    if (!trimmed || !session) return;

    const today = new Date();
    const dueDate = dueToday
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      : null;

    const { id } = createTask({
      project_id: projectId,
      author_id: session.user.id,
      title: trimmed,
      due_date: dueDate,
    });

    // Optimistic append
    queryClient.setQueryData<Task[]>(queryKey, (old) => [
      ...(old ?? []),
      {
        id,
        project_id: projectId,
        section_id: null,
        parent_task_id: null,
        author_id: session.user.id,
        assignee_id: null,
        title: trimmed,
        description: "",
        priority: 4,
        due_date: dueDate,
        due_time: null,
        deadline_date: null,
        recurrence: null,
        recurrence_text: null,
        completed_at: null,
        rank: "m",
        day_rank: "m",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);

    setTitle(""); // composer stays open for rapid entry
  }

  return (
    <form onSubmit={onSubmit} className="mb-4">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…  (Q)"
        className="w-full rounded-[10px] border border-hairline bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-accent"
      />
    </form>
  );
}
