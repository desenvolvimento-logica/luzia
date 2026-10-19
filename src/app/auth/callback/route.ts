import { type NextRequest, NextResponse } from "next/server";
import { resolveCallback } from "@/lib/auth/callback";
import { serverConfig } from "@/lib/server-config";
import { serverSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await serverSupabase();
  const target = await resolveCallback(request.nextUrl.searchParams, {
    exchangeCode: async (code) => ({ ok: !(await supabase.auth.exchangeCodeForSession(code)).error }),
    provision: async () => {
      const { error } = await supabase.rpc("luzia_provision_me");
      return error ? { ok: false, hint: error.hint, code: error.code } : { ok: true };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  });
  // Origem configurada evita depender do cabeçalho Host; o caminho já é interno e validado.
  const origin = serverConfig().hubOrigin ?? request.nextUrl.origin;
  return NextResponse.redirect(new URL(target, origin));
}
