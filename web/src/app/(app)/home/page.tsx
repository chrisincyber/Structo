"use client";

// Home — the modular dashboard (§6). Layout comes from dashboard_layouts
// (device_class 'desktop', seeded at signup); edit mode supports add/remove/
// reorder with a soft cap nudge (§6.10). Drag reorder upgrades this in the
// dnd milestone; move buttons keep it fully keyboard-accessible meanwhile.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { updateRow } from "@/lib/ops";
import { supabase } from "@/lib/supabase";
import type { DashboardLayout, DashboardWidget } from "@/lib/types";
import { Widget, WIDGET_CATALOG, type WidgetType } from "@/components/widgets";
import { uuidv7 } from "@/lib/uuid";

const SOFT_CAP = 8;

async function fetchLayout(): Promise<DashboardLayout> {
  const { data, error } = await supabase()
    .from("dashboard_layouts")
    .select("*")
    .eq("device_class", "desktop")
    .single();
  if (error) throw error;
  return data as DashboardLayout;
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const layout = useQuery({ queryKey: ["dashboard_layouts"], queryFn: fetchLayout });
  const [editing, setEditing] = useState(false);

  const widgets = layout.data?.widgets ?? [];
  const usedTypes = new Set(widgets.map((w) => w.widget_type));
  const available = (Object.keys(WIDGET_CATALOG) as WidgetType[]).filter(
    (t) => !usedTypes.has(t),
  );

  function save(next: DashboardWidget[]) {
    if (!layout.data) return;
    queryClient.setQueryData<DashboardLayout>(["dashboard_layouts"], {
      ...layout.data,
      widgets: next,
    });
    void updateRow("dashboard_layouts", layout.data.id, { widgets: next });
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...widgets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }

  function remove(index: number) {
    save(widgets.filter((_, i) => i !== index));
  }

  function add(type: WidgetType) {
    save([
      ...widgets,
      { instance_id: uuidv7(), widget_type: type, size: "M", config: {} },
    ]);
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{dateLabel}</h1>
        <button
          onClick={() => setEditing((v) => !v)}
          className={`rounded-[10px] px-3 py-1.5 text-sm ${
            editing
              ? "bg-accent font-medium text-accent-contrast"
              : "text-muted hover:bg-hairline/50"
          }`}
        >
          {editing ? "Done" : "Edit Home"}
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {widgets.map((w, i) => (
          <div key={w.instance_id} className="relative">
            {editing && (
              <div className="absolute -top-2 right-2 z-10 flex gap-1 rounded-full border border-hairline bg-card px-1.5 py-0.5 shadow-sm">
                <button
                  aria-label="Move up"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="px-1 text-sm text-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  aria-label="Move down"
                  onClick={() => move(i, 1)}
                  disabled={i === widgets.length - 1}
                  className="px-1 text-sm text-muted disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  aria-label="Remove widget"
                  onClick={() => remove(i)}
                  className="px-1 text-sm text-p1"
                >
                  ×
                </button>
              </div>
            )}
            <Widget type={w.widget_type as WidgetType} />
          </div>
        ))}

        {editing && (
          <div className="rounded-[16px] border border-dashed border-hairline p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Add widget
            </h2>
            {widgets.length >= SOFT_CAP && (
              <p className="mb-2 text-sm text-muted">
                A focused home works better — consider removing one first.
              </p>
            )}
            {available.length === 0 ? (
              <p className="text-sm text-muted">All widgets are on your Home.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {available.map((t) => (
                  <button
                    key={t}
                    onClick={() => add(t)}
                    title={WIDGET_CATALOG[t].description}
                    className="rounded-[10px] border border-hairline px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                  >
                    + {WIDGET_CATALOG[t].title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!editing && widgets.length === 0 && (
          <p className="py-8 text-center text-muted">
            Your Home is empty — tap Edit Home to add widgets.
          </p>
        )}
      </div>
    </div>
  );
}
