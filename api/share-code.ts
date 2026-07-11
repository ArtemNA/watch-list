import type { VercelRequest, VercelResponse } from '@vercel/node';

import { getDb } from './_lib/db';
import { HttpError, requireMethod, withErrorHandling } from './_lib/http';

// Обслуговує GET /api/share/:code через rewrite у vercel.json (як /api/tmdb/*
// → tmdb-proxy): динамічний файл-роут `api/share/[code].ts` НЕ обраний свідомо —
// каталог `api/tmdb/[...path].ts` на цьому проді вже один раз "не матеріалізувався"
// (Step-деплой, docs/PLAN.md), і rewrite-на-плоский-файл — перевірений робочий шлях.

const CODE_RE = /^[A-Za-z0-9]{12}$/;

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireMethod(req, res, 'GET')) {
    return;
  }

  res.setHeader('Cache-Control', 'private, no-store');

  const rawCode = req.query['code'];
  const code = typeof rawCode === 'string' ? rawCode : Array.isArray(rawCode) ? (rawCode[0] ?? '') : '';

  // Однакова відповідь (404) для "невалідний формат", "нема" і "протух" —
  // не видаємо, яка саме причина (ARCHITECTURE §9, крок 4).
  if (!CODE_RE.test(code)) {
    throw new HttpError(404, 'NOT_FOUND');
  }

  const db = await getDb();
  const doc = await db.collection('shares').findOne({ code });
  if (!doc) {
    throw new HttpError(404, 'NOT_FOUND');
  }

  res.status(200).json({ payload: doc['payload'] });
}

export default withErrorHandling(handler);
