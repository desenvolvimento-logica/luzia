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
const uuid = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.uuid().nullable());
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const departmentSchema = z.object({ id: optionalId, name: text(80) });

export const departmentActiveSchema = z.object({ id, active: checkbox });

export const collaboratorSchema = z.object({
  id,
  department_id: id,
  role: z.enum(CARGOS, { message: "Cargo inválido." }),
  is_admin: checkbox,
  access_status: z.enum(["active", "inactive"], { message: "Estado inválido." }),
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
      id: uuid,
      name: text(80),
      description: z.string().trim().max(280, "Máximo de 280 caracteres.").transform((v) => v || null),
      url: z.string().trim(),
      icon: z.string().trim().max(1024),
      active: checkbox,
      audience: z.enum(["all_departments", "selected_departments"], { message: "Escolha a audiência." }),
      department_ids: z.array(id).default([]),
    })
    .superRefine((v, c) => {
      const url = checkAppUrl(v.url, ctx.allowedOrigins, ctx.originOptions);
      if (!url.ok) c.addIssue({ code: "custom", path: ["url"], message: APP_URL_MESSAGES[url.reason] });
      if (v.icon && !isEmojiLike(v.icon) && !isApprovedIconUrl(v.icon, ctx.supabaseUrl, ctx.iconBucket)) {
        c.addIssue({ code: "custom", path: ["icon"], message: "Use um emoji ou envie uma imagem PNG, JPEG ou WebP." });
      }
      if (v.audience === "selected_departments" && v.department_ids.length === 0) {
        c.addIssue({ code: "custom", path: ["department_ids"], message: "Selecione ao menos um departamento." });
      }
    })
    .transform((v) => {
      const url = checkAppUrl(v.url, ctx.allowedOrigins, ctx.originOptions);
      return { ...v, url: url.ok ? url.url : v.url, icon: v.icon || null, department_ids: v.audience === "all_departments" ? [] : v.department_ids };
    });
}

export const noteSchema = z
  .object({
    id: uuid,
    title: text(120),
    body: text(5000),
    version: z.string().trim().max(20).transform((v) => v || null),
    published_at: z.string().trim(),
  })
  .transform((v, c) => {
    const utc = zonedLocalToUtc(v.published_at);
    if (!utc) {
      c.addIssue({ code: "custom", path: ["published_at"], message: "Data de publicação inválida." });
      return z.NEVER;
    }
    return { ...v, published_at: utc };
  });
