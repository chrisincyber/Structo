"use client";

// Sidebar labels list (§7.2). Read-only navigation; labels are created and
// assigned from the task detail panel.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchLabels, qk } from "@/lib/queries";
import { PROJECT_COLORS } from "@/lib/ui";

export function LabelsNav() {
  const pathname = usePathname();
  const { data: labels } = useQuery({ queryKey: qk.labels, queryFn: fetchLabels });

  if (!labels || labels.length === 0) return null;

  return (
    <div className="mt-6">
      <span className="block px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
        Labels
      </span>
      <nav className="space-y-0.5">
        {labels.map((l) => (
          <Link
            key={l.id}
            href={`/label/${l.id}`}
            className={`flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-[15px] ${
              pathname === `/label/${l.id}`
                ? "bg-accent/10 font-medium text-accent"
                : "hover:bg-hairline/50"
            }`}
          >
            <span style={{ color: PROJECT_COLORS[l.color] ?? PROJECT_COLORS.stone }}>@</span>
            <span className="truncate">{l.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
