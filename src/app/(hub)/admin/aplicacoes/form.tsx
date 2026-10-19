"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { TextArea, TextField } from "@/components/ui/field";
import { saveApplication, uploadAppIcon } from "@/features/admin/actions";
import { parseIcon } from "@/lib/security/icon";

interface AppValues {
  id: number;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  active: boolean;
  audience: "todos" | "selecionados";
  dptoIds: number[];
}

export function ApplicationForm({ app, dptos, allowedOrigins }: { app?: AppValues; dptos: { id: number; name: string }[]; allowedOrigins: string[] }) {
  const [audience, setAudience] = useState<"todos" | "selecionados">(app?.audience ?? "selecionados");
  const [icon, setIcon] = useState(app?.icon ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const preview = parseIcon(icon);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.set("arquivo", file);
    const r = await uploadAppIcon(fd);
    setUploading(false);
    if (r.ok) setIcon(r.url);
    else setUploadMsg(r.message);
  }

  return (
    <ActionForm action={saveApplication} className="grid max-w-3xl gap-5">
      {(s) => (
        <>
          {app ? <input type="hidden" name="app_id" value={app.id} /> : null}
          <TextField id="app_name" label="Nome" defaultValue={app?.name} required maxLength={80} error={s.fieldErrors?.app_name} />
          <TextArea id="app_description" label="Descrição curta" defaultValue={app?.description ?? ""} maxLength={280} error={s.fieldErrors?.app_description} />
          <TextField
            id="app_url"
            label="URL publicada"
            type="url"
            inputMode="url"
            defaultValue={app?.url}
            required
            error={s.fieldErrors?.app_url}
            hint={
              allowedOrigins.length
                ? `HTTPS, sem usuário/senha, em uma origem aprovada: ${allowedOrigins.join(", ")}. A origem define para onde a sessão é enviada.`
                : "Nenhuma origem aprovada configurada (LUZIA_APP_ALLOWED_ORIGINS). Nenhuma URL será aceita."
            }
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium">Ícone</legend>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex w-24 flex-col items-center gap-1">
                <div className="flex aspect-[3/4] w-24 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2 text-4xl">
                  {preview.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- prévia do recorte 3:4
                    <img src={preview.url} alt="Prévia do recorte 3:4 da capa" className="size-full object-cover" />
                  ) : preview.kind === "emoji" ? (
                    <span aria-hidden>{preview.value}</span>
                  ) : (
                    <span className="text-xs text-muted">Sem ícone</span>
                  )}
                </div>
                <span className="text-xs text-muted">Prévia 3:4</span>
              </div>
              <div className="flex min-w-60 flex-1 flex-col gap-3">
                <TextField
                  id="app_icon"
                  label="Emoji ou imagem enviada"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  error={s.fieldErrors?.app_icon}
                  hint="Digite um emoji ou envie uma imagem. Imagens fora de 3:4 são cortadas nas laterais."
                />
                <div className="flex flex-col gap-1">
                  <label htmlFor="icon-upload" className="text-sm font-medium">
                    Enviar imagem (PNG, JPEG ou WebP, até 2 MB)
                  </label>
                  <input
                    id="icon-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploading}
                    onChange={(e) => void onFile(e.target.files?.[0])}
                    className="text-sm"
                  />
                  {uploading ? <p role="status" className="text-xs text-muted">Enviando…</p> : null}
                  {uploadMsg ? <p role="alert" className="text-xs text-danger">{uploadMsg}</p> : null}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Audiência</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="audience" value="todos" checked={audience === "todos"} onChange={() => setAudience("todos")} className="size-4" />
              Todos os departamentos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="audience" value="selecionados" checked={audience === "selecionados"} onChange={() => setAudience("selecionados")} className="size-4" />
              Departamentos selecionados
            </label>
            {audience === "selecionados" ? (
              <div className="ml-6 grid gap-2 sm:grid-cols-2" role="group" aria-label="Departamentos com acesso">
                {dptos.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="dpto_ids" value={d.id} defaultChecked={app?.dptoIds.includes(d.id)} className="size-4" />
                    {d.name}
                  </label>
                ))}
              </div>
            ) : null}
            {s.fieldErrors?.dpto_ids ? (
              <p role="alert" className="text-xs text-danger">
                {s.fieldErrors.dpto_ids}
              </p>
            ) : null}
            <p className="text-xs text-muted">“Não atribuído” nunca recebe aplicações, nem as de todos os departamentos.</p>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="app_status" defaultChecked={app?.active ?? true} className="size-5" />
            Aplicação ativa (inativa não abre nem recebe sessão)
          </label>
        </>
      )}
    </ActionForm>
  );
}
