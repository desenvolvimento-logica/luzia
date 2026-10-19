"use client";

import { ActionForm } from "@/components/action-form";
import { TextArea, TextField } from "@/components/ui/field";
import { saveNote } from "@/features/admin/actions";

interface NoteValues {
  id: number;
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
          {note ? <input type="hidden" name="note_id" value={note.id} /> : null}
          <TextField id="note_title" label="Título" defaultValue={note?.title} required maxLength={120} error={s.fieldErrors?.note_title} />
          <TextArea id="note_body" label="Conteúdo (texto puro)" defaultValue={note?.body} required maxLength={5000} error={s.fieldErrors?.note_body} />
          <TextField id="note_version" label="Versão (opcional)" defaultValue={note?.version ?? ""} maxLength={20} error={s.fieldErrors?.note_version} />
          <TextField
            id="dt_publish"
            label="Publicação (horário de Brasília)"
            type="datetime-local"
            defaultValue={note?.publishLocal ?? defaultPublishLocal}
            required
            error={s.fieldErrors?.dt_publish}
            hint="Datas futuras ficam agendadas e só aparecem para administradores até a publicação."
          />
        </>
      )}
    </ActionForm>
  );
}
