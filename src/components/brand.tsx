export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : "text-xl";
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${text}`}>
      <span aria-hidden className="inline-block size-3 rounded-full bg-brand ring-4 ring-brand/25" />
      <span>
        Luz<span className="text-brand-strong">.</span>IA
      </span>
    </span>
  );
}
