import Link from "next/link";

export function ReportTabs({ current }: { current: "acessos" | "atividades" }) {
  const tab = (key: "acessos" | "atividades", href: string, label: string) => (
    <Link
      href={href}
      aria-current={current === key ? "page" : undefined}
      className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-[15px] no-underline ${
        current === key ? "border-brand font-semibold text-text" : "border-transparent text-muted hover:text-text"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Tipo de relatório" className="flex gap-2 border-b border-border">
      {tab("acessos", "/relatorios", "Acessos")}
      {tab("atividades", "/relatorios/atividades", "Atividades")}
    </nav>
  );
}
