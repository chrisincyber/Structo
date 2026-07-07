// Read-side fetchers — blueprint §12.3: reads go through PostgREST guarded by
// RLS (the 90% path). Query keys are normalized per table+view so poke events
// and optimistic updates can invalidate precisely.

import { supabase } from "./supabase";
import type { Habit, HabitLog, Label, Project, Section, Task } from "./types";

export const qk = {
  projects: ["projects"] as const,
  tasksToday: ["tasks", "today"] as const,
  tasksInbox: ["tasks", "inbox"] as const,
  tasksProject: (id: string) => ["tasks", "project", id] as const,
  sections: (projectId: string) => ["sections", projectId] as const,
  habits: ["habits"] as const,
  habitLogsToday: ["habit_logs", "today"] as const,
  labels: ["labels"] as const,
  taskLabelMap: ["task_labels", "map"] as const,
  tasksLabel: (id: string) => ["tasks", "label", id] as const,
};

/** User-local YYYY-MM-DD (floating local dates, §11.12). */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase()
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("rank");
  if (error) throw error;
  return data as Project[];
}

/** Today = due today or overdue, open, not deleted (§11.3). */
export async function fetchTasksToday(): Promise<Task[]> {
  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .is("completed_at", null)
    .lte("due_date", localToday())
    .order("due_date")
    .order("day_rank");
  if (error) throw error;
  return data as Task[];
}

export async function fetchTasksInbox(): Promise<Task[]> {
  const { data: inbox, error: pErr } = await supabase()
    .from("projects")
    .select("id")
    .eq("is_inbox", true)
    .is("deleted_at", null)
    .single();
  if (pErr) throw pErr;

  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .eq("project_id", inbox.id)
    .is("deleted_at", null)
    .is("completed_at", null)
    .order("rank");
  if (error) throw error;
  return data as Task[];
}

export async function fetchInboxProjectId(): Promise<string> {
  const { data, error } = await supabase()
    .from("projects")
    .select("id")
    .eq("is_inbox", true)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase()
    .from("habits")
    .select("*")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("rank");
  if (error) throw error;
  return data as Habit[];
}

export async function fetchHabitLogsToday(): Promise<HabitLog[]> {
  const { data, error } = await supabase()
    .from("habit_logs")
    .select("*")
    .is("deleted_at", null)
    .eq("logged_for", localToday());
  if (error) throw error;
  return data as HabitLog[];
}

export async function fetchProject(id: string): Promise<Project> {
  const { data, error } = await supabase()
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function fetchTasksByProject(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .is("completed_at", null)
    .order("rank");
  if (error) throw error;
  return data as Task[];
}

/** The user's personal workspace id (from their inbox project). */
export async function fetchWorkspaceId(): Promise<string> {
  const { data, error } = await supabase()
    .from("projects")
    .select("workspace_id")
    .eq("is_inbox", true)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data.workspace_id as string;
}

export async function fetchTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Task | null;
}

export async function fetchLabels(): Promise<Label[]> {
  const { data, error } = await supabase()
    .from("labels")
    .select("*")
    .is("deleted_at", null)
    .order("rank");
  if (error) throw error;
  return data as Label[];
}

/** Map of task_id -> label_id[] for the current user's task_labels. */
export async function fetchTaskLabelMap(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase()
    .from("task_labels")
    .select("task_id, label_id")
    .is("deleted_at", null);
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const row of data as { task_id: string; label_id: string }[]) {
    (map[row.task_id] ??= []).push(row.label_id);
  }
  return map;
}

/** Tasks carrying a given label (open, not deleted). */
export async function fetchTasksByLabel(labelId: string): Promise<Task[]> {
  const { data, error } = await supabase()
    .from("task_labels")
    .select("tasks!inner(*)")
    .eq("label_id", labelId)
    .is("deleted_at", null);
  if (error) throw error;
  // supabase-js types the embedded relation as an array; each task_labels row
  // resolves to exactly one task.
  return (data as unknown as { tasks: Task }[])
    .map((r) => r.tasks)
    .filter((t) => t && !t.deleted_at && !t.completed_at);
}

export async function fetchLabel(id: string): Promise<Label> {
  const { data, error } = await supabase()
    .from("labels")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Label;
}

export async function fetchSections(projectId: string): Promise<Section[]> {
  const { data, error } = await supabase()
    .from("sections")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .eq("is_archived", false)
    .order("rank");
  if (error) throw error;
  return data as Section[];
}

/** Habit logs on/after a start date (for weekly/monthly review). */
export async function fetchHabitLogsSince(startDate: string): Promise<HabitLog[]> {
  const { data, error } = await supabase()
    .from("habit_logs")
    .select("*")
    .is("deleted_at", null)
    .gte("logged_for", startDate);
  if (error) throw error;
  return data as HabitLog[];
}

/** All open tasks due strictly before today (overdue), across projects. */
export async function fetchOverdueTasks(): Promise<Task[]> {
  const { data, error } = await supabase()
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .is("completed_at", null)
    .lt("due_date", localToday())
    .order("due_date");
  if (error) throw error;
  return data as Task[];
}

/** Count of completed tasks on/after a date (week scorecard). */
export async function countCompletedSince(startDate: string): Promise<number> {
  const { count, error } = await supabase()
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("completed_at", `${startDate}T00:00:00`);
  if (error) throw error;
  return count ?? 0;
}
