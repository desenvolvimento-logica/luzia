import { Lock } from "lucide-react";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/ui/states";
import { LoginButton } from "./login-button";

/** Órbitas finas em amarelo com a luz ao centro — ornamento vetorial, sem texto por trás. */
function OrbitArt() {
  return (
    <svg viewBox="0 0 600 520" aria-hidden className="h-auto w-full max-w-[560px]" fill="none">
      <g stroke="var(--brand)" strokeOpacity="0.75" strokeWidth="1.4">
        <ellipse cx="300" cy="250" rx="215" ry="150" transform="rotate(-18 300 250)" />
        <ellipse cx="300" cy="250" rx="150" ry="118" transform="rotate(24 300 250)" />
        <path d="M300 20 C 290 140 300 200 300 250 C 300 320 280 400 210 480" strokeOpacity="0.5" />
        <path d="M20 330 C 160 270 240 255 300 250 C 380 245 470 250 560 320" strokeOpacity="0.5" />
      </g>
      <g fill="var(--brand)">
        <circle cx="468" cy="118" r="6" />
        <circle cx="160" cy="310" r="5" />
        <circle cx="470" cy="268" r="5" />
        <path d="M300 214C302.4 236 314 247.6 336 250C314 252.4 302.4 264 300 286C297.6 264 286 252.4 264 250C286 247.6 297.6 236 300 214Z" />
      </g>
      <circle cx="300" cy="250" r="46" fill="var(--brand)" opacity="0.12" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" aria-hidden className="size-5">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export function LoginView({ errorMessage, next, year }: { errorMessage: string | null; next: string; year: number }) {
  return (
    <main id="conteudo" className="grid min-h-dvh lg:grid-cols-[55fr_45fr]">
      <section aria-hidden className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-on-sidebar lg:flex xl:p-16">
        <Brand size="lg" />
        <div className="flex flex-1 items-center justify-center py-8">
          <OrbitArt />
        </div>
        <div>
          <p className="text-[56px] font-bold leading-[1.05] tracking-tight xl:text-[64px]">
            Seu escritório.
            <br />
            <span className="text-brand">Mais conectado.</span>
          </p>
          <p className="mt-5 text-lg text-on-sidebar-muted">As ferramentas da Lógica, reunidas em um só lugar.</p>
        </div>
      </section>

      <section className="flex flex-col bg-bg px-6 py-10 sm:px-12 lg:px-16">
        <div className="lg:hidden">
          <Brand size="lg" />
        </div>
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[400px] py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Bem-vindo à Luz.IA</p>
            <h1 className="mt-4 text-[40px] font-bold leading-[1.1] tracking-tight sm:text-[44px]">Seu trabalho começa aqui.</h1>
            <p className="mt-4 text-lg text-muted">Entre com sua conta corporativa para acessar as aplicações do escritório.</p>
            {errorMessage ? (
              <div className="mt-6">
                <Notice tone="danger">
                  <span role="alert">{errorMessage}</span>
                </Notice>
              </div>
            ) : null}
            <div className="mt-8">
              <LoginButton next={next} logo={<MicrosoftLogo />} />
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
              <Lock aria-hidden className="size-4" />
              Acesso exclusivo para colaboradores.
            </p>
          </div>
        </div>
        <footer className="border-t border-border pt-5 text-sm text-muted">Escritório Lógica Contabilidade / {year}</footer>
      </section>
    </main>
  );
}
