import type { VercelRequest } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { HttpError } from './http';

const BCRYPT_COST = 10;
const JWT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 днів

// JWT (HS256) реалізовано вручну на node:crypto замість бібліотеки jose:
// jose@6 — ESM-only, а @vercel/node компілює .ts-функції у CommonJS, через що
// всі функції з jose падали на проді з FUNCTION_INVOCATION_FAILED ще на
// завантаженні модуля. HS256 — це один HMAC, формат токенів стандартний і
// сумісний з раніше виданими jose-токенами.

function getSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Фіктивний хеш для порівняння часу, коли юзера з таким email нема — щоб /login не видавав
 * існування акаунта через різницю в часі відповіді (bcrypt.compare навмисно повільний). */
let dummyHashPromise: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('watchlist-dummy-password-for-timing-safety');
  }
  return dummyHashPromise;
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function hmac(data: string): Buffer {
  return createHmac('sha256', getSecret()).update(data).digest();
}

export async function signJwt(userId: string): Promise<string> {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlJson({ sub: userId, iat: now, exp: now + JWT_TTL_SECONDS });
  const signature = hmac(`${header}.${payload}`).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyJwt(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  const [header, payload, signature] = parts;

  const expected = hmac(`${header}.${payload}`);
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }

  let claims: { sub?: unknown; exp?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      exp?: unknown;
    };
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  if (
    typeof claims.sub !== 'string' ||
    typeof claims.exp !== 'number' ||
    claims.exp * 1000 <= Date.now()
  ) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  return claims.sub;
}

/** userId з валідного Bearer JWT, або кидає HttpError(401, 'UNAUTHORIZED'). */
export async function requireAuth(req: VercelRequest): Promise<string> {
  const header = req.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  const token = value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  return verifyJwt(token);
}
