import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export const metadata = { title: "Acesso negado" };

export default function AccessDeniedPage() {
  return (
    <ErrorState
      title="Você não tem acesso a esta área"
      action={
        <ButtonLink href="/" variant="secondary">
          Voltar ao catálogo
        </ButtonLink>
      }
    >
      Se precisar deste acesso, procure a administração do Luz.IA.
    </ErrorState>
  );
}
