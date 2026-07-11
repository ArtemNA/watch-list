import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'node:crypto';
import { MongoServerError } from 'mongodb';

import { getDb } from './_lib/db';
import { HttpError, requireMethod, withErrorHandling } from './_lib/http';
import { checkRateLimit, clientIp } from './_lib/rate-limit';
import { sanitizeSharePayload } from './_lib/share-validate';

// POST /api/share — створення тимчасового шеру (ARCHITECTURE §9). Auth НЕ
// обов'язковий: шеринг має працювати і для незалогіненого відправника.

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 12;
const DUPLICATE_KEY_ERROR_CODE = 11000;
const MAX_CODE_ATTEMPTS = 3;

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function publicUrl(req: VercelRequest, code: string): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const host = req.headers['host'] ?? 'localhost';
  return `${proto}://${host}/share/${code}`;
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, 'POST')) {
    return;
  }
  if (!checkRateLimit(`share:${clientIp(req)}`)) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS');
  }

  const payload = sanitizeSharePayload(req.body);
  if (!payload) {
    throw new HttpError(400, 'INVALID_PAYLOAD');
  }

  const db = await getDb();
  const collection = db.collection('shares');

  // Колізія 12-символьного base62 коду астрономічно малоймовірна — але unique
  // index її ловить, тож просто пробуємо ще раз замість передчасної перевірки.
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateCode();
    try {
      await collection.insertOne({ code, payload, createdAt: new Date() });
      res.status(201).json({ code, url: publicUrl(req, code) });
      return;
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE) {
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(500, 'CODE_GENERATION_FAILED');
}

export default withErrorHandling(handler);
