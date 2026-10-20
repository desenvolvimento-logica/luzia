"use client";

import { Upload } from "lucide-react";
import { startTransition, useActionState, useRef, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerFooter, useDrawerClose } from "@/components/ui/drawer";
import { TextArea, TextField } from "@/components/ui/field";
import { saveApplication, uploadAppIcon } from "@/features/admin/actions";
import type { FormState } from "@/features/admin/schemas";

type Audience = "all_departments" | "selected_departments";

export interface DrawerApp {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  active: boolean;
  audience: Audience;
  departmentIds: number[];
}

interface Props {
  app?: DrawerApp;
  departments: { id: number; name: string }[];
  allowedOrigins: string[];
  readOnly: boolean;
  closeHref: string;
}

function CancelButton({ label = "Cancelar" }: { label?: string }) {
  const close = useDrawerClose();
  return (
    <Button variant="secondary" onClick={close}>
      {label}
    </Button>
  );
}

function ReadOnlyDetails({ app, departments }: { app: DrawerApp; departments: { id: number; name: string }[] }) {
  const names = departments.filter((d) => app.departmentIds.includes(d.id)).map((d) => d.name);
  return (
    <dl className="grid gap-4 text-sm">
      {[
        ["Descrição", app.description ?? "—"],
        ["URL", app.url],
        ["Quem pode acessar", app.audience === "all_departments" ? "Todos os departamentos" : names.join(", ") || "—"],
        ["Status", app.active ? "Ativa" : "Inativa"],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="font-medium">{k}</dt>
          <dd className="mt-0.5 break-words text-muted">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ApplicationDrawer({ app, departments, allowedOrigins, readOnly, closeHref }: Props) {
  const dirty = useRef(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveApplication, { ok: false, message: null });
  const [audience, setAudience] = useState<Audience>(app?.audience ?? "selected_departments");
  const [active, setActive] = useState(app?.active ?? true);
  const [icon, setIcon] = useState(app?.icon ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const e = state.fieldErrors ?? {};

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.set("arquivo", file);
    const r = await uploadAppIcon(fd);
    setUploading(false);
    if (r.ok) {
      setIcon(r.url);
      dirty.current = true;
    } else setUploadMsg(r.message);
  }

  const title = readOnly ? (app?.name ?? "Aplicação") : app ? "Editar aplicação" : "Nova aplicação";
  return (
    <Drawer title={title} closeHref={closeHref} returnFocusId={app ? `editar-${app.id}` : "nova-aplicacao"} isDirty={() => dirty.current}>
      {readOnly && app ? (
        <>
          <DrawerBody>
            <div className="mb-5 flex items-center gap-3">
              <AppIcon icon={app.icon} name={app.name} />
              <p className="text-lg font-semibold">{app.name}</p>
            </div>
            <ReadOnlyDetails app={app} departments={departments} />
          </DrawerBody>
          <DrawerFooter>
            <CancelButton label="Fechar" />
          </DrawerFooter>
        </>
      ) : (
        <form
          // Envio manual: com a prop `action` o React limpa os campos mesmo quando o servidor recusa.
          onSubmit={(ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            startTransition(() => formAction(fd));
          }}
          onInput={() => {
            dirty.current = true;
          }}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <DrawerBody>
            <div className="flex flex-col gap-5">
              {app ? <input type="hidden" name="id" value={app.id} /> : null}
              <TextField id="name" label="Nome" defaultValue={app?.name} required maxLength={80} error={e.name} autoFocus />
              <TextArea id="description" label="Descrição" defaultValue={app?.description ?? ""} maxLength={280} error={e.description} />
              <TextField
                id="url"
                label="URL"
                type="url"
                inputMode="url"
                defaultValue={app?.url}
                required
                error={e.url}
                hint={
                  allowedOrigins.length
                    ? `HTTPS em uma origem aprovada: ${allowedOrigins.join(", ")}. A origem define para onde a sessão é enviada.`
                    : "Nenhuma origem aprovada configurada (LUZIA_APP_ALLOWED_ORIGINS)."
                }
              />

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-medium">Ícone da aplicação</legend>
                <div className="flex items-start gap-4">
                  <AppIcon icon={icon || null} name="Prévia" size="lg" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-control px-4 text-sm font-medium hover:bg-surface-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--focus)]">
                      <Upload aria-hidden className="size-4" />
                      {uploading ? "Enviando…" : "Alterar ícone"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(ev) => void onFile(ev.target.files?.[0])} />
                    </label>
                    <p className="text-xs text-muted">Proporção 3:4 recomendada. PNG, JPEG ou WebP · até 2 MB. Imagens fora de 3:4 são cortadas nas laterais.</p>
                    {uploadMsg ? (
                      <p role="alert" className="text-xs text-danger">
                        {uploadMsg}
                      </p>
                    ) : null}
                  </div>
                </div>
                <TextField id="icon" label="Ou use um emoji" value={icon} onChange={(ev) => setIcon(ev.target.value)} error={e.icon} placeholder="Ex.: 🧾" />
              </fieldset>

              <hr className="border-border" />

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">
                  Quem pode acessar?<span aria-hidden className="ml-0.5 text-danger">*</span>
                </legend>
                {(
                  [
                    ["all_departments", "Todos os departamentos"],
                    ["selected_departments", "Departamentos selecionados"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex min-h-10 items-center gap-3 text-[15px]">
                    <input type="radio" name="audience" value={value} checked={audience === value} onChange={() => setAudience(value)} className="size-5 accent-[var(--brand)]" />
                    {label}
                  </label>
                ))}
                {audience === "selected_departments" ? (
                  <div role="group" aria-label="Departamentos com acesso" className="mt-1 grid gap-1 rounded-[var(--radius-control)] border border-border p-3">
                    {departments.map((d) => (
                      <label key={d.id} className="flex min-h-10 items-center gap-3 text-[15px]">
                        <input type="checkbox" name="department_ids" value={d.id} defaultChecked={app?.departmentIds.includes(d.id)} className="size-5 accent-[var(--brand)]" />
                        {d.name}
                      </label>
                    ))}
                  </div>
                ) : null}
                {e.department_ids ? (
                  <p role="alert" className="text-xs text-danger">
                    {e.department_ids}
                  </p>
                ) : null}
                <p className="text-xs text-muted">“Não atribuído” nunca recebe aplicações, nem as de todos os departamentos.</p>
              </fieldset>

              <hr className="border-border" />

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Status</p>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    role="switch"
                    name="active"
                    checked={active}
                    onChange={(ev) => setActive(ev.target.checked)}
                    aria-describedby="status-hint"
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] ${
                      active ? "bg-brand" : "bg-surface-2 ring-1 ring-inset ring-[var(--control-border)]"
                    }`}
                  >
                    <span className={`absolute top-1 size-5 rounded-full bg-surface shadow transition-transform ${active ? "translate-x-6" : "translate-x-1"}`} />
                  </span>
                  <span className="text-[15px]">Aplicação ativa</span>
                </label>
                <p id="status-hint" className="text-xs text-muted">
                  Aplicações inativas não aparecem no catálogo, não abrem e não recebem sessão.
                </p>
              </div>
            </div>
          </DrawerBody>
          <DrawerFooter>
            {state.message ? (
              <p role={state.ok ? "status" : "alert"} className={`mr-auto text-sm ${state.ok ? "text-success" : "text-danger"}`}>
                {state.message}
              </p>
            ) : null}
            <CancelButton />
            <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>
              {pending ? "Salvando…" : app ? "Salvar alterações" : "Criar aplicação"}
            </Button>
          </DrawerFooter>
        </form>
      )}
    </Drawer>
  );
}
