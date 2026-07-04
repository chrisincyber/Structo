"use client";

// App shell (§7.2): persistent left sidebar + content pane. Auth-guarded;
// subscribes to the per-user poke channel and invalidates queries on change.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { signOut, useAuth } from "@/lib/auth";
import { subscribeToPokes } from "@/lib/poke";

const NAV = [
  { href: "/home", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/habits", label: "Habits" },
] as const;

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

  if (loading || !session) {
    return <main className="flex flex-1 items-center justify-center text-muted">Loading…</main>;
  }

  return (
    <div className="flex flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-hairline p-4">
        <p className="px-2 pb-4 text-lg font-bold tracking-tight">Planoa</p>
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
        <button
          onClick={() => void signOut()}
          className="mt-auto rounded-[10px] px-2 py-1.5 text-left text-sm text-muted hover:bg-hairline/50"
        >
          Sign out
        </button>
      </aside>
      <main className="mx-auto w-full max-w-[680px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
