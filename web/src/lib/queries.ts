// Read-side fetchers — blueprint §12.3: reads go through PostgREST guarded by
// RLS (the 90% path). Query keys are normalized per table+view so poke events
// and optimistic updates can invalidate precisely.

import { supabase } from "./supabase";
import type { Habit, HabitLog, Project, Task } from "./types";

export const qk = {
  projects: ["projects"] as const,
  tasksToday: ["tasks", "today"] as const,
  tasksInbox: ["tasks", "inbox"] as const,
  tasksProject: (id: string) => ["tasks", "project", id] as const,
  habits: ["habits"] as const,
  habitLogsToday: ["habit_logs", "today"] as const,
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
