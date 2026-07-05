// Row types mirroring supabase/migrations/0001_schema.sql.
// Hand-maintained until a real Supabase project exists, then replaced by
// `supabase gen types typescript` output (keep field names identical).

export type Recurrence = {
  v: 1;
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  weekdays?: number[]; // ISO, 1 = Monday
  monthday?: number;
  anchor?: string; // YYYY-MM-DD, set at rule creation
  mode?: "fixed" | "after_completion";
};

export type HabitSchedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] }
  | { kind: "per_week" };

export interface Project {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  color: string;
  rank: string;
  is_inbox: boolean;
  is_archived: boolean;
  view_layout: "list" | "board";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Section {
  id: string;
  project_id: string;
  name: string;
  rank: string;
  is_archived: boolean;
  updated_at: string;
  deleted_at: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  author_id: string;
  assignee_id: string | null;
  title: string;
  description: string;
  priority: 1 | 2 | 3 | 4;
  due_date: string | null; // YYYY-MM-DD, floating local (§11.12)
  due_time: string | null; // HH:MM:SS, floating local
  deadline_date: string | null;
  recurrence: Recurrence | null;
  recurrence_text: string | null;
  completed_at: string | null;
  rank: string;
  day_rank: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Label {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  rank: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Habit {
  id: string;
  owner_id: string;
  name: string;
  icon: string;
  color: string | null;
  type: "binary" | "quantity" | "frequency";
  target_value: number | null;
  unit: string | null;
  times_per_week: number | null;
  schedule: HabitSchedule;
  reminder_time: string | null;
  rank: string;
  is_paused: boolean;
  paused_at: string | null;
  archived_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  logged_for: string; // YYYY-MM-DD, user-local day it counts toward
  value: number; // negative = compensating entry (§5.4)
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HabitStats {
  habit_id: string;
  user_id: string;
  current_streak: number;
  best_streak: number;
  streak_unit: "days" | "weeks";
  completions_this_week: number;
  computed_at: string;
}

export interface Reminder {
  id: string;
  owner_id: string;
  task_id: string;
  kind: "absolute" | "offset";
  remind_at: string | null;
  offset_minutes: number | null;
  fired_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export interface DashboardWidget {
  instance_id: string;
  widget_type: string;
  size: "S" | "M" | "L";
  config: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  user_id: string;
  device_class: "phone" | "desktop";
  widgets: DashboardWidget[];
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  default_landing: "home" | "today";
  accent: string;
  time_format: "system" | "12h" | "24h";
  notification_prefs: Record<string, unknown>;
  agenda_time: string | null;
  updated_at: string;
}

/** Tables servable by pull_table_deltas() (0006). */
export const SYNCED_TABLES = [
  "profiles",
  "projects",
  "sections",
  "tasks",
  "labels",
  "saved_views",
  "habits",
  "habit_logs",
  "habit_stats",
  "reminders",
  "dashboard_layouts",
  "user_preferences",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
