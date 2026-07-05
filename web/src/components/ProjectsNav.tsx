"use client";

// Sidebar projects tree (§7.2): non-inbox projects with color dots and an
// inline "+ New project" that picks the next curated color automatically.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { dispatch } from "@/lib/ops";
import { fetchProjects, fetchWorkspaceId, qk } from "@/lib/queries";
import type { Project } from "@/lib/types";
import { PROJECT_COLORS } from "@/lib/ui";
import { uuidv7 } from "@/lib/uuid";

export function ProjectsNav() {
  const { session } = useAuth();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const projects = useQuery({ queryKey: qk.projects, queryFn: fetchProjects });
  const workspace = useQuery({ queryKey: ["workspace-id"], queryFn: fetchWorkspaceId });

  const visible = (projects.data ?? []).filter((p) => !p.is_inbox);

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !session || !workspace.data) return;

    const colorNames = Object.keys(PROJECT_COLORS);
    const color = colorNames[visible.length % colorNames.length];
    const id = uuidv7();
    const row: Project = {
      id,
      workspace_id: workspace.data,
      owner_id: session.user.id,
      name: trimmed,
      color,
      rank: "m",
      is_inbox: false,
      is_archived: false,
      view_layout: "list",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    queryClient.setQueryData<Project[]>(qk.projects, (old) => [...(old ?? []), row]);
    void dispatch({
      op_id: uuidv7(),
      verb: "upsert",
      table: "projects",
      row: {
        id,
        workspace_id: workspace.data,
        owner_id: session.user.id,
        name: trimmed,
        color,
      },
    });
    setName("");
    setAdding(false);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Projects
        </span>
        <button
          aria-label="New project"
          onClick={() => setAdding((v) => !v)}
          className="text-muted hover:text-accent"
        >
          +
        </button>
      </div>

      {adding && (
        <form onSubmit={onCreate} className="px-2 pb-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="Project name"
            className="w-full rounded-[10px] border border-hairline bg-card px-2 py-1 text-sm outline-none focus:border-accent"
          />
        </form>
      )}

      <nav className="space-y-0.5">
        {visible.map((p) => (
          <Link
            key={p.id}
            href={`/project/${p.id}`}
            className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] ${
              pathname === `/project/${p.id}`
                ? "bg-accent/10 font-medium text-accent"
                : "hover:bg-hairline/50"
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: PROJECT_COLORS[p.color] ?? PROJECT_COLORS.stone }}
            />
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
