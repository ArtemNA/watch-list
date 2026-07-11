import type { VercelRequest } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

import { HttpError } from './http';

const BCRYPT_COST = 10;
const JWT_TTL = '30d';

function getSecret(): Uint8Array {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
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

export async function signJwt(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(JWT_TTL)
    .sign(getSecret());
}

async function verifyJwt(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret());
  if (typeof payload.sub !== 'string') {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  return payload.sub;
}

/** userId з валідного Bearer JWT, або кидає HttpError(401, 'UNAUTHORIZED'). */
export async function requireAuth(req: VercelRequest): Promise<string> {
  const header = req.headers['authorization'];
  const value = Array.isArray(header) ? header[0] : header;
  const token = value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : undefined;
  if (!token) {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
  try {
    return await verifyJwt(token);
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED');
  }
}
