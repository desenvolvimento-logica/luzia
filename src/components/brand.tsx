/** Marca Luz.IA: símbolo de luz de quatro pontas (vetor) + texto real. */
export function BrandMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d="M12 2C12.8 8 16 11.2 22 12C16 12.8 12.8 16 12 22C11.2 16 8 12.8 2 12C8 11.2 11.2 8 12 2Z" fill="var(--brand)" />
    </svg>
  );
}

export function Brand({ size = "md", collapsed = false }: { size?: "md" | "lg"; collapsed?: boolean }) {
  const text = size === "lg" ? "text-3xl" : "text-xl";
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${text}`}>
      <BrandMark className={size === "lg" ? "size-7" : "size-6"} />
      <span className={collapsed ? "sr-only" : undefined}>Luz.IA</span>
    </span>
  );
}
