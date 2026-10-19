import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/ui/states";
import { loginErrorMessage } from "@/lib/auth/callback";
import { safeNextPath } from "@/lib/security/redirect";
import { LoginButton } from "./login-button";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const erro = typeof params.erro === "string" ? params.erro : null;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const message = loginErrorMessage(erro);

  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <Brand size="lg" />
        <p className="mt-2 text-sm text-muted">Escritório Lógica Contabilidade</p>
        <h1 className="mt-8 text-lg font-semibold">Acesse suas aplicações</h1>
        <p className="mt-1 text-sm text-muted">Use a conta Microsoft corporativa do escritório.</p>
        {message ? (
          <div className="mt-4">
            <Notice tone="danger">
              <span role="alert">{message}</span>
            </Notice>
          </div>
        ) : null}
        <div className="mt-6">
          <LoginButton next={next} />
        </div>
        <p className="mt-6 text-xs text-muted">Não há cadastro público nem login por senha no hub.</p>
      </div>
    </main>
  );
}
