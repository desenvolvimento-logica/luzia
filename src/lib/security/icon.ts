// Ícone de aplicação: emoji curto ou URL https de imagem no bucket aprovado (compatível com o legado).

export type IconValue = { kind: "emoji"; value: string } | { kind: "image"; url: string } | { kind: "none" };

const MAX_EMOJI_LENGTH = 16;

export function parseIcon(raw: string | null | undefined): IconValue {
  const value = (raw ?? "").trim();
  if (!value) return { kind: "none" };
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const localDev = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
      if ((url.protocol === "https:" || localDev) && !url.username && !url.password) return { kind: "image", url: url.toString() };
    } catch {
      /* cai para "none" */
    }
    return { kind: "none" };
  }
  return isEmojiLike(value) ? { kind: "emoji", value } : { kind: "none" };
}

export function isEmojiLike(value: string): boolean {
  if (value.length > MAX_EMOJI_LENGTH) return false;
  return /\p{Extended_Pictographic}/u.test(value) && !/[\p{L}\p{N}<>&"'`]/u.test(value.replace(/️|‍/g, ""));
}

/** Aceita imagem somente do bucket público configurado no projeto Supabase. */
export function isApprovedIconUrl(url: string, supabaseUrl: string | undefined, bucket: string): boolean {
  if (!supabaseUrl) return false;
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    return u.origin === base.origin && u.pathname.startsWith(`/storage/v1/object/public/${bucket}/`);
  } catch {
    return false;
  }
}
