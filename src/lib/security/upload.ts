// Validação de imagem de capa: tipo pelo conteúdo (assinatura), não pela extensão ou cabeçalho do cliente.

export const ICON_MAX_BYTES = 2 * 1024 * 1024;
export type IconMime = "image/png" | "image/jpeg" | "image/webp";
export const ICON_EXTENSION: Record<IconMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export type UploadCheck = { ok: true; mime: IconMime } | { ok: false; message: string };

export function sniffImage(bytes: Uint8Array): IconMime | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 && b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return "image/png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  return null;
}

export function checkIconUpload(bytes: Uint8Array, declaredType: string): UploadCheck {
  if (bytes.byteLength === 0) return { ok: false, message: "Arquivo vazio." };
  if (bytes.byteLength > ICON_MAX_BYTES) return { ok: false, message: "A imagem deve ter no máximo 2 MB." };
  if (/svg/i.test(declaredType)) return { ok: false, message: "SVG não é aceito. Envie PNG, JPEG ou WebP." };
  const mime = sniffImage(bytes);
  if (!mime) return { ok: false, message: "Formato não reconhecido. Envie PNG, JPEG ou WebP." };
  if (declaredType && declaredType !== mime && !(declaredType === "image/jpg" && mime === "image/jpeg")) {
    return { ok: false, message: "O conteúdo do arquivo não corresponde ao tipo informado." };
  }
  return { ok: true, mime };
}
