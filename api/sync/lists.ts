import type { VercelRequest, VercelResponse } from '@vercel/node';

import { requireAuth } from '../_lib/auth';
import { getDb } from '../_lib/db';
import { HttpError, withErrorHandling } from '../_lib/http';
import { sanitizeSyncList, type SyncList } from '../_lib/sync-validate';

// Дзеркало api/sync/items.ts (той самий pull/push/tombstone механізм,
// ARCHITECTURE §9) для колекції `lists`. Свідомо НЕ шариться код з items.ts —
// два маленькі файли простіші за одну параметризовану абстракцію заради двох викликів.

const PULL_LIMIT = 500;
const PUSH_LIMIT = 200;

type ListDoc = SyncList & { userId: string; serverUpdatedAt: string };

function stripDoc(doc: ListDoc): SyncList {
  const { userId: _userId, serverUpdatedAt: _serverUpdatedAt, ...list } = doc;
  delete (list as { _id?: unknown })._id;
  return list;
}

async function handlePull(req: VercelRequest, res: VercelResponse, userId: string): Promise<void> {
  const rawSince = req.query['since'];
  const since = typeof rawSince === 'string' && rawSince ? rawSince : undefined;

  const db = await getDb();
  const collection = db.collection<ListDoc>('lists');

  const filter: Record<string, unknown> = { userId };
  if (since) {
    filter['serverUpdatedAt'] = { $gt: since };
  }

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
    throw new HttpError(400, 'INVALID_LISTS');
  }

  const lists: SyncList[] = [];
  for (const raw of body.items) {
    const list = sanitizeSyncList(raw);
    if (!list) {
      throw new HttpError(400, 'INVALID_LISTS');
    }
    lists.push(list);
  }

  const db = await getDb();
  const collection = db.collection<ListDoc>('lists');

  const saved: string[] = [];
  const conflicts: SyncList[] = [];

  for (const list of lists) {
    const existing = await collection.findOne({ userId, id: list.id });

    if (existing && existing.updatedAt > list.updatedAt) {
      conflicts.push(stripDoc(existing));
      continue;
    }
    if (existing && existing.updatedAt === list.updatedAt) {
      saved.push(list.id);
      continue;
    }

    await collection.replaceOne(
      { userId, id: list.id },
      { ...list, userId, serverUpdatedAt: new Date().toISOString() },
      { upsert: true },
    );
    saved.push(list.id);
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
