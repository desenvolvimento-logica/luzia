import Link from "next/link";

export function ReportTabs({ current }: { current: "acessos" | "atividades" }) {
  const tab = (key: "acessos" | "atividades", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`inline-flex min-h-10 items-center border-b-2 px-3 text-sm text-text no-underline ${
        current === key ? "border-brand font-medium" : "border-transparent text-muted hover:border-border"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Tipo de relatório" className="mb-4 flex gap-2 border-b border-border">
      {tab("acessos", "/relatorios", "Acessos pelo hub")}
      {tab("atividades", "/relatorios/atividades", "Atividades nas aplicações")}
    </nav>
  );
}
