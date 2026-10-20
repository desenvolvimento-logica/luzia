/** A pré-visualização de interface só existe quando explicitamente ligada (nunca definida na Vercel). */
export function previewEnabled(): boolean {
  return process.env.LUZIA_UI_PREVIEW === "true";
}
