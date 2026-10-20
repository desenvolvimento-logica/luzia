import type { Metadata } from "next";
import { loginErrorMessage } from "@/lib/auth/callback";
import { safeNextPath } from "@/lib/security/redirect";
import { currentYear } from "@/lib/time";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const erro = typeof params.erro === "string" ? params.erro : null;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  return <LoginView errorMessage={loginErrorMessage(erro)} next={next} year={currentYear()} />;
}
