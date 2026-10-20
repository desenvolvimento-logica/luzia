import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { THEME_COOKIE, themeClass } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Luz.IA", template: "%s · Luz.IA" },
  description: "Portal de aplicações do Escritório Lógica Contabilidade",
  robots: { index: false, follow: false },
};

// Baixada no build e servida pelo próprio site (nenhuma requisição ao Google no navegador; CSP font-src 'self').
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html lang="pt-BR" className={`${themeClass(theme)} ${inter.variable}`.trim()}>
      <body className="min-h-dvh">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
