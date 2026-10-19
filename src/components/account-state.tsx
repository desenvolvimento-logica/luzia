import type { ReactNode } from "react";
import { Brand } from "./brand";
import { Button } from "./ui/button";

export function AccountState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="conteudo" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8">
        <Brand />
        <h1 className="mt-6 text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted">{children}</p>
        <form action="/auth/sair" method="post" className="mt-6">
          <Button type="submit" variant="secondary">
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
