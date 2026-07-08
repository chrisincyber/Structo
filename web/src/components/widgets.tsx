"use client";

// Widget registry + the 7 launch widgets (§6.3). The catalog is code, not a
// DB table (§10.19). Every widget is operational — it supports a direct
// action or a meaningful tap-through (§6.6). Uniform anatomy: caption title
// row, content, no footers (§9.5).

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HabitsBand } from "@/components/HabitsBand";
import { QuickAdd } from "@/components/QuickAdd";
import { useAuth } from "@/lib/auth";
import { completeTask, logHabit } from "@/lib/ops";
import {
  fetchHabitLogsToday,
  fetchHabits,
  fetchInboxProjectId,
  fetchTasksToday,
  localToday,
  qk,
} from "@/lib/queries";
import { computeStreak, dayTotal } from "@/lib/streaks";
import { supabase } from "@/lib/supabase";
import type { HabitLog, Task } from "@/lib/types";

export type WidgetType =
  | "today_tasks"
  | "habits_today"
  | "quick_add"
  | "upcoming_peek"
  | "quick_log"
  | "streaks"
  | "inbox_count";

export const WIDGET_CATALOG: Record<
  WidgetType,
  { title: string; description: string }
> = {
  today_tasks: { title: "Today", description: "Top tasks, complete in place" },
  habits_today: { title: "Habits", description: "Today's habits, tap to log" },
  quick_add: { title: "Quick add", description: "Capture without leaving Home" },
  upcoming_peek: { title: "Upcoming", description: "The next few days at a glance" },
  quick_log: { title: "Quick log", description: "One-tap counter for a quantity habit" },
  streaks: { title: "Streaks", description: "Your longest running habits" },
  inbox_count: { title: "Inbox", description: "A gentle 'process me' cue" },
};

export function Widget({ type }: { type: WidgetType }) {
  switch (type) {
    case "today_tasks":
      return <TodayTasksWidget />;
    case "habits_today":
      return <HabitsTodayWidget />;
    case "quick_add":
      return <QuickAddWidget />;
    case "upcoming_peek":
      return <UpcomingPeekWidget />;
    case "quick_log":
      return <QuickLogWidget />;
    case "streaks":
      return <StreaksWidget />;
    case "inbox_count":
      return <InboxCountWidget />;
  }
}

function Card({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-hairline bg-card p-4">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        {href ? <Link href={href}>{title} →</Link> : title}
      </h2>
      {children}
    </section>
  );
}

function TodayTasksWidget() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: qk.tasksToday, queryFn: fetchTasksToday });

  function complete(task: Task) {
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
      Array.isArray(old) ? old.filter((t) => t.id !== task.id) : old,
    );
    void completeTask(task.id).then(() =>
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    );
  }

  return (
    <Card title="Today" href="/today">
      {tasks.data && tasks.data.length > 0 ? (
        <ul className="space-y-1.5">
          {tasks.data.slice(0, 5).map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <button
                aria-label={`Complete ${t.title}`}
                onClick={() => complete(t)}
                className="h-4 w-4 shrink-0 rounded border-2 border-muted/50 hover:bg-accent/20"
              />
              <span className="truncate text-[15px]">{t.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing due. Enjoy it.</p>
      )}
      {(tasks.data?.length ?? 0) > 5 && (
        <Link href="/today" className="mt-2 block text-sm text-accent">
          +{tasks.data!.length - 5} more →
        </Link>
      )}
    </Card>
  );
}

function HabitsTodayWidget() {
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({ queryKey: qk.habitLogsToday, queryFn: fetchHabitLogsToday });
  return (
    <Card title="Habits" href="/habits">
      {habits.data && habits.data.length > 0 ? (
        <HabitsBand habits={habits.data} logs={logs.data ?? []} />
      ) : (
        <p className="text-sm text-muted">No habits yet.</p>
      )}
    </Card>
  );
}

function QuickAddWidget() {
  const inbox = useQuery({ queryKey: ["projects", "inbox-id"], queryFn: fetchInboxProjectId });
  return (
    <Card title="Quick add">
      {inbox.data ? (
        <QuickAdd projectId={inbox.data} queryKey={qk.tasksInbox} />
      ) : (
        <p className="text-sm text-muted">…</p>
      )}
    </Card>
  );
}

function UpcomingPeekWidget() {
  const { data } = useQuery({
    queryKey: ["tasks", "upcoming-peek"],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase()
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .is("completed_at", null)
        .gt("due_date", localToday())
        .order("due_date")
        .limit(4);
      if (error) throw error;
      return data as Task[];
    },
  });
  return (
    <Card title="Upcoming" href="/upcoming">
      {data && data.length > 0 ? (
        <ul className="space-y-1.5">
          {data.map((t) => (
            <li key={t.id} className="flex items-baseline gap-2 text-[15px]">
              <span className="shrink-0 text-xs text-muted">{t.due_date?.slice(5)}</span>
              <span className="truncate">{t.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing scheduled.</p>
      )}
    </Card>
  );
}

function QuickLogWidget() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const logs = useQuery({ queryKey: qk.habitLogsToday, queryFn: fetchHabitLogsToday });

  // First quantity habit (per-widget habit picker lands with widget options)
  const habit = (habits.data ?? []).find((h) => h.type === "quantity" && !h.is_paused);
  if (!habit) {
    return (
      <Card title="Quick log">
        <p className="text-sm text-muted">Create a quantity habit (like water) to use this.</p>
      </Card>
    );
  }

  const pairs = (logs.data ?? [])
    .filter((l) => l.habit_id === habit.id)
    .map((l) => [l.logged_for, Number(l.value)] as [string, number]);
  const total = dayTotal(pairs, localToday());
  const target = Number(habit.target_value ?? 1);

  function onLog() {
    if (!session) return;
    queryClient.setQueryData<HabitLog[]>(qk.habitLogsToday, (old) => [
      ...(old ?? []),
      {
        id: crypto.randomUUID(),
        habit_id: habit!.id,
        user_id: session.user.id,
        logged_for: localToday(),
        value: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ]);
    void logHabit({
      habit_id: habit!.id,
      user_id: session.user.id,
      logged_for: localToday(),
      value: 1,
    });
  }

  return (
    <Card title={habit.name}>
      <button
        onClick={onLog}
        className="flex w-full items-center justify-between rounded-[10px] bg-accent/10 px-4 py-3 text-accent transition-colors hover:bg-accent/20"
      >
        <span className="text-2xl font-bold tabular-nums">
          {total}
          <span className="text-sm font-normal text-muted">/{target}</span>
        </span>
        <span className="text-xl">＋</span>
      </button>
    </Card>
  );
}

function StreaksWidget() {
  const habits = useQuery({ queryKey: qk.habits, queryFn: fetchHabits });
  const { data: logs } = useQuery({
    queryKey: ["habit_logs", "recent"],
    queryFn: async (): Promise<HabitLog[]> => {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase()
        .from("habit_logs")
        .select("*")
        .is("deleted_at", null)
        .gte("logged_for", since);
      if (error) throw error;
      return data as HabitLog[];
    },
  });

  const today = localToday();
  const rows = (habits.data ?? [])
    .filter((h) => !h.is_paused)
    .map((h) => {
      const pairs = (logs ?? [])
        .filter((l) => l.habit_id === h.id)
        .map((l) => [l.logged_for, Number(l.value)] as [string, number]);
      return { habit: h, streak: computeStreak(h, pairs, today) };
    })
    .filter((r) => r.streak.current > 0)
    .sort((a, b) => b.streak.current - a.streak.current)
    .slice(0, 4);

  return (
    <Card title="Streaks" href="/habits">
      {rows.length > 0 ? (
        <ul className="space-y-1.5">
          {rows.map(({ habit, streak }) => (
            <li key={habit.id} className="flex items-baseline justify-between text-[15px]">
              <span className="truncate">{habit.name}</span>
              <span className="shrink-0 text-sm font-semibold text-accent tabular-nums">
                {streak.current} {streak.unit === "weeks" ? "wk" : "d"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Streaks appear as you log habits.</p>
      )}
    </Card>
  );
}

function InboxCountWidget() {
  const tasks = useQuery({ queryKey: qk.tasksInbox, queryFn: async () => (await import("@/lib/queries")).fetchTasksInbox() });
  const count = tasks.data?.length ?? 0;
  return (
    <Card title="Inbox" href="/inbox">
      <p className="text-2xl font-bold tabular-nums">
        {count}
        <span className="ml-2 text-sm font-normal text-muted">
          {count === 0 ? "clear ✓" : count === 1 ? "item to process" : "items to process"}
        </span>
      </p>
    </Card>
  );
}
