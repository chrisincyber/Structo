"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { session, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Home is the default landing (§7.2); the synced default_landing
    // preference is mirrored to localStorage by the app shell.
    const landing =
      localStorage.getItem("structo.landing") === "today" ? "/today" : "/home";
    router.replace(configured && session ? landing : "/login");
  }, [loading, session, configured, router]);

  return <main className="flex flex-1 items-center justify-center text-muted">…</main>;
}
