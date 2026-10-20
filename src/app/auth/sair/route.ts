import { type NextRequest, NextResponse } from "next/server";
import { serverConfig } from "@/lib/server-config";
import { serverSupabase } from "@/lib/supabase/server";

// POST para evitar logout por link/prefetch. scope "local": encerra só esta sessão (a que o hub entregou às
// aplicações em iframe), sem derrubar sessões do mesmo usuário em outros sistemas do projeto compartilhado
// (mesma escolha do HelpDesk GC). Sessões já persistidas nas aplicações seguem a regra de cada uma (docs/operacao.md).
export async function POST(request: NextRequest) {
  const supabase = await serverSupabase();
  await supabase.auth.signOut({ scope: "local" });
  const origin = serverConfig().hubOrigin ?? request.nextUrl.origin;
  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
