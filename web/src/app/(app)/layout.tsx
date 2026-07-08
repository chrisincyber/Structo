"use client";

// App shell (§7.2): persistent left sidebar + content pane. Auth-guarded;
// subscribes to the per-user poke channel and invalidates queries on change;
// applies the synced accent preference to the document root.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { LabelsNav } from "@/components/LabelsNav";
import { ProjectsNav } from "@/components/ProjectsNav";
import { TaskDetail } from "@/components/TaskDetail";
import { signOut, useAuth } from "@/lib/auth";
import { subscribeToPokes } from "@/lib/poke";
import { supabase } from "@/lib/supabase";
import type { UserPreferences } from "@/lib/types";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/inbox", label: "Inbox" },
  { href: "/habits", label: "Habits" },
  { href: "/search", label: "Search" },
] as const;

const NAV_KEYS: Record<string, string> = {
  h: "/home",
  t: "/today",
  u: "/upcoming",
  i: "/inbox",
  b: "/habits",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!configured || (!loading && !session)) router.replace("/login");
  }, [configured, loading, session, router]);

  useEffect(() => {
    if (!session) return;
    return subscribeToPokes(session.user.id, (table) => {
      void queryClient.invalidateQueries({ queryKey: [table] });
    });
  }, [session, queryClient]);

  const prefs = useQuery({
    queryKey: ["user_preferences"],
    queryFn: async (): Promise<UserPreferences> => {
      const { data, error } = await supabase()
        .from("user_preferences")
        .select("*")
        .single();
      if (error) throw error;
      return data as UserPreferences;
    },
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (prefs.data?.accent) {
      document.documentElement.dataset.accent = prefs.data.accent;
      localStorage.setItem("structo.landing", prefs.data.default_landing);
    }
  }, [prefs.data]);

  // g-then-key navigation + f for search (§14.3)
  useEffect(() => {
    let pendingG = false;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      const key = e.key.toLowerCase();
      if (pendingG && NAV_KEYS[key]) {
        e.preventDefault();
        router.push(NAV_KEYS[key]);
        pendingG = false;
        return;
      }
      pendingG = key === "g";
      if (key === "f") {
        e.preventDefault();
        router.push("/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (loading || !session) {
    return <main className="flex flex-1 items-center justify-center text-muted">Loading…</main>;
  }

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-hairline p-4">
        <p className="px-2 pb-4 text-lg font-bold tracking-tight">Structo</p>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-[10px] px-2 py-1.5 text-[15px] ${
                pathname === item.href
                  ? "bg-accent/10 font-medium text-accent"
                  : "hover:bg-hairline/50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ProjectsNav />
        <LabelsNav />
        <div className="mt-auto space-y-0.5">
          <Link
            href="/review"
            className="block rounded-[10px] px-2 py-1.5 text-sm text-muted hover:bg-hairline/50"
          >
            Weekly review
          </Link>
          <Link
            href="/completed"
            className="block rounded-[10px] px-2 py-1.5 text-sm text-muted hover:bg-hairline/50"
          >
            Completed
          </Link>
          <Link
            href="/settings"
            className="block rounded-[10px] px-2 py-1.5 text-sm text-muted hover:bg-hairline/50"
          >
            Settings
          </Link>
          <button
            onClick={() => void signOut()}
            className="block w-full rounded-[10px] px-2 py-1.5 text-left text-sm text-muted hover:bg-hairline/50"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-[680px] flex-1 px-6 py-8">{children}</main>
      <TaskDetail />
    </div>
  );
}
