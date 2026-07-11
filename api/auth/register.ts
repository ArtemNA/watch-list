import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoServerError } from 'mongodb';

import { hashPassword, signJwt } from '../_lib/auth';
import { getDb } from '../_lib/db';
import { HttpError, requireMethod, withErrorHandling } from '../_lib/http';
import { checkRateLimit, clientIp } from '../_lib/rate-limit';
import { isValidEmail, isValidPassword, normalizeEmail } from '../_lib/validators';

const DUPLICATE_KEY_ERROR_CODE = 11000;

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, 'POST')) {
    return;
  }
  if (!checkRateLimit(`register:${clientIp(req)}`)) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS');
  }

  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email)) {
    throw new HttpError(400, 'INVALID_EMAIL');
  }
  if (!isValidPassword(password)) {
    throw new HttpError(400, 'PASSWORD_TOO_SHORT');
  }

  const db = await getDb();
  const passwordHash = await hashPassword(password);

  let insertedId;
  try {
    const result = await db.collection('users').insertOne({ email, passwordHash, createdAt: new Date() });
    insertedId = result.insertedId;
  } catch (error) {
    // Покладаємось на unique-індекс замість find-then-insert — без TOCTOU-вікна
    // між перевіркою і вставкою при паралельних реєстраціях того самого email.
    if (error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE) {
      throw new HttpError(409, 'EMAIL_TAKEN');
    }
    throw error;
  }

  const token = await signJwt(insertedId.toString());
  res.status(201).json({ token, email });
}

export default withErrorHandling(handler);
