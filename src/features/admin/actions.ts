"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthorizationError, requireAction } from "@/lib/auth/session";
import { dbErrorMessage } from "@/lib/errors";
import { checkIconUpload, ICON_EXTENSION } from "@/lib/security/upload";
import { serverConfig } from "@/lib/server-config";
import { applicationSchema, collaboratorSchema, dptoSchema, fieldErrors, type FormState, noteSchema } from "./schemas";

// Cada ação revalida o administrador no servidor; o banco revalida de novo (RLS + gatilhos + auditoria).
async function admin() {
  return requireAction("admin");
}

function denied(e: unknown): FormState {
  if (e instanceof AuthorizationError) return { ok: false, message: "Somente administradores ativos podem fazer esta alteração." };
  throw e;
}

export async function saveDpto(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = dptoSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const { dpto_id, dpto_name } = parsed.data;
    const { error } = dpto_id
      ? await supabase.from("dpto").update({ dpto_name }).eq("dpto_id", dpto_id)
      : await supabase.from("dpto").insert({ dpto_name, user_create: "luzia-admin" });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/departamentos");
    return { ok: true, message: dpto_id ? "Departamento atualizado." : "Departamento criado." };
  } catch (e) {
    return denied(e);
  }
}

export async function deleteDpto(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = z.coerce.number().int().positive().safeParse(form.get("dpto_id"));
    if (!parsed.success) return { ok: false, message: "Departamento inválido." };
    const { error, count } = await supabase.from("dpto").delete({ count: "exact" }).eq("dpto_id", parsed.data);
    if (error) return { ok: false, message: dbErrorMessage(error) };
    if (!count) return { ok: false, message: "Departamento não encontrado." };
    revalidatePath("/admin/departamentos");
    return { ok: true, message: "Departamento excluído." };
  } catch (e) {
    return denied(e);
  }
}

export async function updateCollaborator(_: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await admin();
    const parsed = collaboratorSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const { user_id, ...changes } = parsed.data;
    // Identidade e e-mail não fazem parte do formulário (procedimento próprio: admin_change_identity).
    const { error, count } = await supabase.from("users").update(changes, { count: "exact" }).eq("user_id", user_id);
    if (error) return { ok: false, message: dbErrorMessage(error) };
    if (!count) return { ok: false, message: "Colaborador não encontrado." };
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: "Colaborador atualizado." };
  } catch (e) {
    return denied(e);
  }
}

export async function saveApplication(_: FormState, form: FormData): Promise<FormState> {
  let savedId: number;
  try {
    const { supabase } = await admin();
    const cfg = serverConfig();
    const schema = applicationSchema({
      allowedOrigins: cfg.appOrigins,
      originOptions: { allowLocal: cfg.allowLocalApps },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      iconBucket: cfg.iconBucket,
    });
    const parsed = schema.safeParse({ ...Object.fromEntries(form), dpto_ids: form.getAll("dpto_ids") });
    if (!parsed.success) return { ok: false, message: "Revise os campos.", fieldErrors: fieldErrors(parsed.error) };
    const v = parsed.data;
    const { data, error } = await supabase.rpc("admin_save_application", {
      p_app_id: v.app_id,
      p_name: v.app_name,
      p_description: v.app_description,
      p_url: v.app_url,
      p_icon: v.app_icon,
      p_status: v.app_status,
      p_audience: v.audience,
      p_dpto_ids: v.dpto_ids,
    });
    if (error || typeof data !== "number") return { ok: false, message: dbErrorMessage(error) };
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
    const { supabase } = await admin();
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
    const { note_id, ...values } = parsed.data;
    const { error } = note_id
      ? await supabase.from("patch_notes").update(values).eq("note_id", note_id)
      : await supabase.from("patch_notes").insert({ ...values, user_create: "luzia-admin" });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin/novidades");
    revalidatePath("/novidades");
    return { ok: true, message: note_id ? "Novidade atualizada." : "Novidade criada." };
  } catch (e) {
    return denied(e);
  }
}
