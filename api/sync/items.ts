import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../_lib/auth';
import { getDb } from '../_lib/db';
import { HttpError, withErrorHandling } from '../_lib/http';
import { sanitizeSyncItem, type SyncItem } from '../_lib/sync-validate';

const PULL_LIMIT = 500;
const PUSH_LIMIT = 200;

// Документ у Mongo: SyncItem + userId + serverUpdatedAt (ISO). serverUpdatedAt —
// СЕРВЕРНИЙ маркер для pull-курсора: клієнтські updatedAt генеруються різними
// пристроями з різними годинниками, тому фільтрувати pull по них не можна
// (пристрій із «відсталим» годинником губився б назавжди).
type ItemDoc = SyncItem & { userId: string; serverUpdatedAt: string };

function stripDoc(doc: ItemDoc): SyncItem {
  const { userId: _userId, serverUpdatedAt: _serverUpdatedAt, ...item } = doc;
  delete (item as { _id?: unknown })._id;
  return item;
}

async function handlePull(req: VercelRequest, res: VercelResponse, userId: string): Promise<void> {
  const rawSince = req.query['since'];
  const since = typeof rawSince === 'string' && rawSince ? rawSince : undefined;

  const db = await getDb();
  const collection = db.collection<ItemDoc>('items');

  const filter: Record<string, unknown> = { userId };
  if (since) {
    filter['serverUpdatedAt'] = { $gt: since };
  }

  // limit+1, щоб дізнатись, чи є ще сторінка, не рахуючи документи окремим запитом.
  const docs = await collection
    .find(filter)
    .sort({ serverUpdatedAt: 1 })
    .limit(PULL_LIMIT + 1)
    .toArray();

  const hasMore = docs.length > PULL_LIMIT;
  const page = hasMore ? docs.slice(0, PULL_LIMIT) : docs;
  const next = hasMore ? page[page.length - 1].serverUpdatedAt : null;

  res.status(200).json({
    items: page.map(stripDoc),
    next,
    serverTime: new Date().toISOString(),
  });
}

async function handlePush(req: VercelRequest, res: VercelResponse, userId: string): Promise<void> {
  const body = (req.body ?? {}) as { items?: unknown };
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > PUSH_LIMIT) {
    throw new HttpError(400, 'INVALID_ITEMS');
  }

  const items: SyncItem[] = [];
  for (const raw of body.items) {
    const item = sanitizeSyncItem(raw);
    if (!item) {
      throw new HttpError(400, 'INVALID_ITEMS');
    }
    items.push(item);
  }

  const db = await getDb();
  const collection = db.collection<ItemDoc>('items');

  const saved: string[] = [];
  const conflicts: SyncItem[] = [];

  for (const item of items) {
    const existing = await collection.findOne({ userId, id: item.id });

    if (existing && existing.updatedAt > item.updatedAt) {
      // На сервері новіша версія (інший пристрій встиг раніше) — не перезаписуємо,
      // повертаємо серверну версію: клієнт прожене її через merge і запушить результат.
      conflicts.push(stripDoc(existing));
      continue;
    }
    if (existing && existing.updatedAt === item.updatedAt) {
      // Та сама версія (повторний push / echo після pull) — нічого не пишемо,
      // щоб не бампати serverUpdatedAt і не ганяти цей айтем між пристроями вічно.
      saved.push(item.id);
      continue;
    }

    await collection.replaceOne(
      { userId, id: item.id },
      { ...item, userId, serverUpdatedAt: new Date().toISOString() },
      { upsert: true },
    );
    saved.push(item.id);
  }

  res.status(200).json({ saved, conflicts });
}

async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const userId = await requireAuth(req);

  if (req.method === 'GET') {
    await handlePull(req, res, userId);
    return;
  }
  if (req.method === 'POST') {
    await handlePush(req, res, userId);
    return;
  }
  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
}

export default withErrorHandling(handler);
