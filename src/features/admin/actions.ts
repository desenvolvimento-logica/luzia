"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthorizationError, requireAction } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { checkIconUpload, ICON_EXTENSION } from "@/lib/security/upload";
import { serverConfig } from "@/lib/server-config";
import {
  applicationSchema, collaboratorSchema, departmentActiveSchema, departmentSchema, fieldErrors, type FormState, noteSchema,
} from "./schemas";

// Cada ação revalida o administrador no servidor; o banco revalida de novo nas RPCs luzia_admin_*
// (admin ativo + fase primary), com auditoria e espelho para o legado na mesma transação.
async function admin() {
  return requireAction("admin");
}

function denied(e: unknown): FormState {
  if (e instanceof AuthorizationError) return { ok: false, message: "Somente administradores ativos podem fazer esta alteração." };
  throw e;
}

export async function saveDepartment(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = departmentSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const { error } = await supabase.rpc("luzia_admin_save_department", { p_id: parsed.data.id, p_name: parsed.data.name });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/departamentos");
    return { ok: true, message: parsed.data.id ? "Departamento atualizado." : "Departamento criado." };
  } catch (e) {
    return denied(e);
  }
}

export async function setDepartmentActive(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = departmentActiveSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Departamento inválido." };
    const { error } = await supabase.rpc("luzia_admin_set_department_active", { p_id: parsed.data.id, p_active: parsed.data.active });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/departamentos");
    return { ok: true, message: parsed.data.active ? "Departamento reativado." : "Departamento desativado." };
  } catch (e) {
    return denied(e);
  }
}

export async function updateCollaborator(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = collaboratorSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const v = parsed.data;
    // Identidade e e-mail não fazem parte do formulário (procedimento próprio: luzia_admin_change_identity).
    const { error } = await supabase.rpc("luzia_admin_update_collaborator", {
      p_id: v.id,
      p_department_id: v.department_id,
      p_role: v.role,
      p_is_admin: v.is_admin,
      p_access_status: v.access_status,
    });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: "Colaborador atualizado." };
  } catch (e) {
    return denied(e);
  }
}

export async function adoptLegacyCollaborators(): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const { data, error } = await supabase.rpc("luzia_admin_adopt_legacy_collaborators");
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: data ? `${data} cadastro(s) adotado(s) do legado.` : "Nenhum cadastro novo no legado." };
  } catch (e) {
    return denied(e);
  }
}

export async function saveApplication(_: FormState, form: FormData): Promise<FormState> {
  let savedId: string;
  try {
    const { supabase } = await admin();
    const cfg = serverConfig();
    const schema = applicationSchema({
      allowedOrigins: cfg.appOrigins,
      originOptions: { allowLocal: cfg.allowLocalApps },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      iconBucket: cfg.iconBucket,
    });
    const parsed = schema.safeParse({ ...Object.fromEntries(form), department_ids: form.getAll("department_ids") });
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const v = parsed.data;
    const { data, error } = await supabase.rpc("luzia_admin_save_application", {
      p_id: v.id,
      p_name: v.name,
      p_description: v.description,
      p_url: v.url,
      p_icon: v.icon,
      p_active: v.active,
      p_audience: v.audience,
      p_department_ids: v.department_ids,
    });
    if (error || typeof data !== "string") return { ok: false, message: dbErrorMessage(error) };
    savedId = data;
  } catch (e) {
    return denied(e);
  }
  revalidatePath("/admin/aplicacoes");
  revalidatePath("/");
  redirect(`/admin/aplicacoes/${savedId}?salvo=1`);
}

export async function uploadAppIcon(form: FormData): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    const { supabase, user } = await admin();
    if (user.adminReadOnly) return { ok: false, message: "Durante a transição, ícones são alterados no hub antigo." };
    const file = form.get("arquivo");
    if (!(file instanceof File)) return { ok: false, message: "Selecione uma imagem." };
    if (file.size > 2 * 1024 * 1024) return { ok: false, message: "A imagem deve ter no máximo 2 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = checkIconUpload(bytes, file.type);
    if (!check.ok) return { ok: false, message: check.message };
    const cfg = serverConfig();
    const path = `apps/${randomUUID()}.${ICON_EXTENSION[check.mime]}`;
    // Upload com a sessão do admin: a política do bucket (legado: só admin escreve) continua valendo.
    const { error } = await supabase.storage.from(cfg.iconBucket).upload(path, bytes, { contentType: check.mime, upsert: false });
    if (error) return { ok: false, message: "Não foi possível enviar a imagem." };
    return { ok: true, url: supabase.storage.from(cfg.iconBucket).getPublicUrl(path).data.publicUrl };
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, message: "Somente administradores." };
    return { ok: false, message: "Falha no envio da imagem." };
  }
}

export async function saveNote(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = noteSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const v = parsed.data;
    const { error } = await supabase.rpc("luzia_admin_save_news", {
      p_id: v.id,
      p_title: v.title,
      p_body: v.body,
      p_version: v.version,
      p_published_at: v.published_at,
    });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/novidades");
    revalidatePath("/novidades");
    return { ok: true, message: v.id ? "Novidade atualizada." : "Novidade criada." };
  } catch (e) {
    return denied(e);
  }
}
