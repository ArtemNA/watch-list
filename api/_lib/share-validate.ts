// Валідація SharePayload (Step 12, ARCHITECTURE §9) — той самий підхід, що
// sync-validate.ts: приймає й САНІТИЗУЄ (лише відомі поля) або повертає null.
// Entries мають рівно той самий формат, що ListEntry в синку списків, тому
// перевикористовуємо sanitizeListEntry замість дублювання валідації.

import { sanitizeListEntry, type SyncListEntry } from './sync-validate';

const MAX_NAME = 300;
const MAX_SHARED_BY = 200;
const MAX_ENTRIES = 1000;
const MAX_PAYLOAD_BYTES = 256_000;

export interface SharePayload {
  v: 1;
  name: string;
  sharedBy: string;
  entries: SyncListEntry[];
}

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** Перевіряє і санітизує payload шеру. `null`, якщо невалідний (вхід із зовнішнього світу — ARCHITECTURE §9). */
export function sanitizeSharePayload(raw: unknown): SharePayload | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const body = raw as Record<string, unknown>;

  if (body['v'] !== 1) {
    return null;
  }
  if (!isNonEmptyString(body['name'], MAX_NAME)) {
    return null;
  }
  if (!isNonEmptyString(body['sharedBy'], MAX_SHARED_BY)) {
    return null;
  }
  if (!Array.isArray(body['entries']) || body['entries'].length > MAX_ENTRIES) {
    return null;
  }

  const entries: SyncListEntry[] = [];
  for (const rawEntry of body['entries']) {
    const entry = sanitizeListEntry(rawEntry);
    if (!entry) {
      return null;
    }
    entries.push(entry);
  }

  const payload: SharePayload = {
    v: 1,
    name: body['name'] as string,
    sharedBy: body['sharedBy'] as string,
    entries,
  };

  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    return null;
  }
  return payload;
}
