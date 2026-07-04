"use client";

import { useQuery } from "@tanstack/react-query";
import { QuickAdd } from "@/components/QuickAdd";
import { TaskRow } from "@/components/TaskRow";
import { fetchInboxProjectId, fetchTasksInbox, qk } from "@/lib/queries";

export default function InboxPage() {
  const tasks = useQuery({ queryKey: qk.tasksInbox, queryFn: fetchTasksInbox });
  const inbox = useQuery({ queryKey: ["projects", "inbox-id"], queryFn: fetchInboxProjectId });

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
      <p className="mt-0.5 mb-6 text-sm text-muted">
        Capture first, organize later.
      </p>

      {inbox.data && <QuickAdd projectId={inbox.data} queryKey={qk.tasksInbox} />}

      {tasks.isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : tasks.data && tasks.data.length > 0 ? (
        <ul>{tasks.data.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
      ) : (
        <p className="py-8 text-center text-muted">Inbox zero.</p>
      )}
    </div>
  );
}
