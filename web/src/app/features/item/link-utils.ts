const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/** Додає `https://`, якщо в URL немає схеми. Порожній рядок лишає порожнім. */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  return SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** URL фавіконки хоста через Google s2 favicons. Порожній рядок, якщо URL невалідний. */
export function faviconUrl(rawUrl: string): string {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    return '';
  }
  try {
    const hostname = new URL(normalized).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}`;
  } catch {
    return '';
  }
}
