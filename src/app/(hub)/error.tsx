"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function HubError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorState
      title="Não foi possível carregar esta página"
      action={
        <Button variant="secondary" onClick={() => retry()}>
          Tentar novamente
        </Button>
      }
    >
      Verifique sua conexão. Se o problema continuar, informe a administração.
    </ErrorState>
  );
}
