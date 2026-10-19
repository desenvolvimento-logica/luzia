"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LOGIN_ERROR_MESSAGES } from "@/lib/auth/callback";
import { browserSupabase } from "@/lib/supabase/browser";

export function LoginButton({ next }: { next: string }) {
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
      <Button variant="primary" className="w-full" onClick={signIn} disabled={pending} aria-busy={pending}>
        <LogIn aria-hidden className="size-4" />
        {pending ? "Redirecionando…" : "Entrar com Microsoft"}
      </Button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
