import { AppWindow } from "lucide-react";
import { parseIcon } from "@/lib/security/icon";

const SIZES = {
  sm: { tile: "size-10 text-xl rounded-[8px]", cover: "w-9", icon: "size-5" },
  md: { tile: "size-14 text-3xl rounded-[10px]", cover: "w-12", icon: "size-6" },
  lg: { tile: "size-16 text-4xl rounded-[12px]", cover: "w-14", icon: "size-7" },
} as const;

/**
 * Emoji (ou ícone padrão) num quadrado de destaque; imagem cadastrada mantém o formato de capa 3:4 (object-cover),
 * como no legado — o quadrado compacto não substitui a capa.
 */
export function AppIcon({ icon, name, size = "md" }: { icon: string | null; name: string; size?: keyof typeof SIZES }) {
  const parsed = parseIcon(icon);
  const s = SIZES[size];
  if (parsed.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagens do Storage, sem otimizador configurado
      <img src={parsed.url} alt="" className={`${s.cover} aspect-[3/4] shrink-0 rounded-[8px] border border-border object-cover`} loading="lazy" />
    );
  }
  return (
    <span aria-hidden title={name} className={`inline-flex shrink-0 items-center justify-center bg-brand-soft ${s.tile}`}>
      {parsed.kind === "emoji" ? parsed.value : <AppWindow className={`${s.icon} text-text`} />}
    </span>
  );
}
