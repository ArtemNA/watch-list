import type { VercelRequest } from '@vercel/node';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

/**
 * Найпростіший rate limit: in-memory Map по ключу (напр. `register:1.2.3.4`).
 * Best-effort на serverless — кожен "теплий" інстанс лямбди має свою Map, холодний
 * старт чи паралельний інстанс лічильник обнуляє. Досить, щоб зупинити наївний
 * брутфорс-скрипт, не заміна production rate-limiter (Redis тощо).
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (value) {
    return value.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}
