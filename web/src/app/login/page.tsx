"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithMagicLink, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { session, loading, configured } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    if (!loading && session) router.replace("/today");
  }, [loading, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      await signInWithMagicLink(email.trim());
      setState("sent");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold tracking-tight">Planoa</h1>
        <p className="mt-1 text-muted">Your day, in one place.</p>

        {!configured ? (
          <p className="mt-8 rounded-[16px] border border-hairline bg-card p-4 text-sm text-muted">
            Backend not configured yet. Set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to sign in.
          </p>
        ) : state === "sent" ? (
          <p className="mt-8 rounded-[16px] border border-hairline bg-card p-4 text-sm">
            Check your email — we sent you a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-[10px] border border-hairline bg-card px-4 py-2.5 text-[15px] outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="w-full rounded-[10px] bg-accent px-4 py-2.5 text-[15px] font-medium text-accent-contrast disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {state === "error" && (
              <p className="text-sm text-p1">Could not send the link. Try again.</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
