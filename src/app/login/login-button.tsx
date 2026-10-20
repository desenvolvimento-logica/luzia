"use client";

import { Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { LOGIN_ERROR_MESSAGES } from "@/lib/auth/callback";
import { browserSupabase } from "@/lib/supabase/browser";

export function LoginButton({ next, logo }: { next: string; logo: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (next !== "/") redirectTo.searchParams.set("next", next);
      const { error: oauthError } = await browserSupabase().auth.signInWithOAuth({
        provider: "azure",
        options: { redirectTo: redirectTo.toString(), scopes: "email openid profile" },
      });
      if (oauthError) throw oauthError;
    } catch {
      setError(LOGIN_ERROR_MESSAGES.indisponivel);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-[var(--radius-control)] border border-control bg-surface px-4 text-base font-semibold text-text shadow-[0_1px_2px_rgb(16_24_40_/_0.06)] transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : logo}
        {pending ? "Redirecionando…" : "Entrar com Microsoft"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
