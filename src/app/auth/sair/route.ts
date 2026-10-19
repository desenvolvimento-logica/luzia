import { type NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/lib/server-config";
import { serverSupabase } from "@/lib/supabase/server";

// POST para evitar logout por link/prefetch. Encerrar a sessão no hub não encerra sessões já
// persistidas nas aplicações integradas (docs/operacao.md).
export async function POST(request: NextRequest) {
  const supabase = await serverSupabase();
  await supabase.auth.signOut();
  const origin = serverConfig().hubOrigin ?? request.nextUrl.origin;
  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
