"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { session, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Home is the default landing screen (§7.2); default_landing preference
    // overrides this once preferences are wired in.
    router.replace(configured && session ? "/home" : "/login");
  }, [loading, session, configured, router]);

  return <main className="flex flex-1 items-center justify-center text-muted">…</main>;
}
