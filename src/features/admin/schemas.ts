import { z } from "zod";
import { CARGOS } from "@/lib/auth/matrix";
import { APP_URL_MESSAGES, checkAppUrl } from "@/lib/security/app-url";
import { isApprovedIconUrl, isEmojiLike } from "@/lib/security/icon";
import type { OriginOptions } from "@/lib/security/origins";
import { zonedLocalToUtc } from "@/lib/time";

export interface FormState {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
}

export const initialFormState: FormState = { ok: false, message: null };

const id = z.coerce.number().int().positive();
const optionalId = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), id.nullable());
const text = (max: number) => z.string().trim().min(1, "Campo obrigatório.").max(max, `Máximo de ${max} caracteres.`);
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const dptoSchema = z.object({ dpto_id: optionalId, dpto_name: text(80) });

export const collaboratorSchema = z.object({
  user_id: id,
  user_dpto: id,
  user_role: z.enum(CARGOS, { message: "Cargo inválido." }),
  is_admin: checkbox,
  access_status: z.enum(["ativo", "desativado"], { message: "Estado inválido." }),
});

export interface AppSchemaContext {
  allowedOrigins: readonly string[];
  originOptions: OriginOptions;
  supabaseUrl: string | undefined;
  iconBucket: string;
}

export function applicationSchema(ctx: AppSchemaContext) {
  return z
    .object({
      app_id: optionalId,
      app_name: text(80),
      app_description: z.string().trim().max(280, "Máximo de 280 caracteres.").transform((v) => v || null),
      app_url: z.string().trim(),
      app_icon: z.string().trim().max(1024),
      app_status: checkbox,
      audience: z.enum(["todos", "selecionados"], { message: "Escolha a audiência." }),
      dpto_ids: z.array(id).default([]),
    })
    .superRefine((v, c) => {
      const url = checkAppUrl(v.app_url, ctx.allowedOrigins, ctx.originOptions);
      if (!url.ok) c.addIssue({ code: "custom", path: ["app_url"], message: APP_URL_MESSAGES[url.reason] });
      if (v.app_icon && !isEmojiLike(v.app_icon) && !isApprovedIconUrl(v.app_icon, ctx.supabaseUrl, ctx.iconBucket)) {
        c.addIssue({ code: "custom", path: ["app_icon"], message: "Use um emoji ou envie uma imagem PNG, JPEG ou WebP." });
      }
      if (v.audience === "selecionados" && v.dpto_ids.length === 0) {
        c.addIssue({ code: "custom", path: ["dpto_ids"], message: "Selecione ao menos um departamento." });
      }
    })
    .transform((v) => {
      const url = checkAppUrl(v.app_url, ctx.allowedOrigins, ctx.originOptions);
      return { ...v, app_url: url.ok ? url.url : v.app_url, app_icon: v.app_icon || null, dpto_ids: v.audience === "todos" ? [] : v.dpto_ids };
    });
}

export const noteSchema = z
  .object({
    note_id: optionalId,
    note_title: text(120),
    note_body: text(5000),
    note_version: z.string().trim().max(20).transform((v) => v || null),
    dt_publish: z.string().trim(),
  })
  .transform((v, c) => {
    const utc = zonedLocalToUtc(v.dt_publish);
    if (!utc) {
      c.addIssue({ code: "custom", path: ["dt_publish"], message: "Data de publicação inválida." });
      return z.NEVER;
    }
    return { ...v, dt_publish: utc };
  });
