"use client";

// Settings (§3.9): control without clutter — fits on one screen.
// Accent + default landing persist to user_preferences (synced); the accent
// applies instantly via the data-accent attribute (globals.css overrides).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut, useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { UserPreferences } from "@/lib/types";

const ACCENTS = [
  { name: "teal", light: "#0F766E" },
  { name: "indigo", light: "#4338CA" },
  { name: "plum", light: "#86198F" },
  { name: "ochre", light: "#A16207" },
  { name: "forest", light: "#166534" },
  { name: "slate", light: "#334155" },
] as const;

async function fetchPrefs(): Promise<UserPreferences> {
  const { data, error } = await supabase()
    .from("user_preferences")
    .select("*")
    .single();
  if (error) throw error;
  return data as UserPreferences;
}

export default function SettingsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: ["user_preferences"], queryFn: fetchPrefs });

  async function save(patch: Partial<UserPreferences>) {
    queryClient.setQueryData<UserPreferences>(["user_preferences"], (old) =>
      old ? { ...old, ...patch } : old,
    );
    if (patch.accent) {
      document.documentElement.setAttribute("data-accent", patch.accent);
    }
    if (patch.default_landing) {
      localStorage.setItem("structo.landing", patch.default_landing);
    }
    // Preferences skip the op path (single row, no ordering needs — 0004 notes)
    await supabase()
      .from("user_preferences")
      .update(patch)
      .eq("user_id", session!.user.id);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-0.5 mb-8 text-sm text-muted">{session?.user.email}</p>

      <div className="space-y-8">
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Accent
          </h2>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.name}
                aria-label={`Accent ${a.name}`}
                onClick={() => void save({ accent: a.name })}
                className={`h-8 w-8 rounded-full transition-transform ${
                  prefs.data?.accent === a.name
                    ? "scale-110 ring-2 ring-offset-2 ring-offset-background"
                    : ""
                }`}
                style={{ background: a.light }}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Open app to
          </h2>
          <div className="flex gap-1.5">
            {(["home", "today"] as const).map((v) => (
              <button
                key={v}
                onClick={() => void save({ default_landing: v })}
                className={`rounded-[10px] border px-3 py-1.5 text-sm capitalize ${
                  prefs.data?.default_landing === v
                    ? "border-accent bg-accent/10 font-medium text-accent"
                    : "border-hairline"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Account
          </h2>
          <button
            onClick={() => void signOut()}
            className="rounded-[10px] border border-hairline px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
