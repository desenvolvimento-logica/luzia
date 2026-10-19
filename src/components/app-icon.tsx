import { AppWindow } from "lucide-react";
import { parseIcon } from "@/lib/security/icon";

/** Emoji ou imagem de capa em proporção 3:4 (object-cover), como no legado. */
export function AppIcon({ icon, name, size = "md" }: { icon: string | null; name: string; size?: "sm" | "md" }) {
  const parsed = parseIcon(icon);
  const box = size === "sm" ? "w-9" : "w-16";
  if (parsed.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagens do Storage, sem otimizador configurado
      <img src={parsed.url} alt="" className={`${box} aspect-[3/4] shrink-0 rounded-md border border-border object-cover`} loading="lazy" />
    );
  }
  return (
    <span
      aria-hidden
      title={name}
      className={`${box} inline-flex aspect-[3/4] shrink-0 items-center justify-center rounded-md bg-surface-2 ${size === "sm" ? "text-lg" : "text-3xl"}`}
    >
      {parsed.kind === "emoji" ? parsed.value : <AppWindow className="size-1/2 text-muted" />}
    </span>
  );
}
