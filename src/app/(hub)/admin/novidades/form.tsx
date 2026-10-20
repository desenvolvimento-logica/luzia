"use client";

import { ActionForm } from "@/components/action-form";
import { TextArea, TextField } from "@/components/ui/field";
import { saveNote } from "@/features/admin/actions";

interface NoteValues {
  id: string;
  title: string;
  body: string;
  version: string | null;
  publishLocal: string;
}

export function NoteForm({ note, defaultPublishLocal }: { note?: NoteValues; defaultPublishLocal: string }) {
  return (
    <ActionForm action={saveNote}>
      {(s) => (
        <>
          {note ? <input type="hidden" name="id" value={note.id} /> : null}
          <TextField id="title" label="Título" defaultValue={note?.title} required maxLength={120} error={s.fieldErrors?.title} />
          <TextArea id="body" label="Conteúdo (texto puro)" defaultValue={note?.body} required maxLength={5000} error={s.fieldErrors?.body} />
          <TextField id="version" label="Versão (opcional)" defaultValue={note?.version ?? ""} maxLength={20} error={s.fieldErrors?.version} />
          <TextField
            id="published_at"
            label="Publicação (horário de Brasília)"
            type="datetime-local"
            defaultValue={note?.publishLocal ?? defaultPublishLocal}
            required
            error={s.fieldErrors?.published_at}
            hint="Datas futuras ficam agendadas e só aparecem para administradores até a publicação."
          />
        </>
      )}
    </ActionForm>
  );
}
