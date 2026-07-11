import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getDummyHash, signJwt, verifyPassword } from '../_lib/auth';
import { getDb } from '../_lib/db';
import { HttpError, requireMethod, withErrorHandling } from '../_lib/http';
import { checkRateLimit, clientIp } from '../_lib/rate-limit';
import { normalizeEmail } from '../_lib/validators';

interface UserDoc {
  email: string;
  passwordHash: string;
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, 'POST')) {
    return;
  }
  if (!checkRateLimit(`login:${clientIp(req)}`)) {
    throw new HttpError(429, 'TOO_MANY_REQUESTS');
  }

  const body = (req.body ?? {}) as { email?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const db = await getDb();
  const user = await db.collection<UserDoc>('users').findOne({ email });

  // Порівнюємо пароль навіть коли юзера нема (проти фіктивного хешу) — інакше
  // відповідь "нема юзера" повертається швидше за "не той пароль" і email можна
  // перебирати по часу відповіді. Повідомлення про помилку однакове в обох випадках.
  const hash = user?.passwordHash ?? (await getDummyHash());
  const passwordValid = await verifyPassword(password, hash);

  if (!user || !passwordValid) {
    throw new HttpError(401, 'INVALID_CREDENTIALS');
  }

  const token = await signJwt(user._id.toString());
  res.status(200).json({ token, email: user.email });
}

export default withErrorHandling(handler);
