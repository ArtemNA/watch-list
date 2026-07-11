import { mergeEntries } from '../data/list-entry';
import type { ListEntry, MediaList } from '../models/media-list.model';

// Merge-логіка для колекції `lists` (ARCHITECTURE §9 + Step 11, задача 7):
// той самий підхід, що core/sync/merge.ts для items, з ключовою відмінністю —
// `entries` НІКОЛИ не потрапляють у fields-конфлікт: об'єднуються автоматично
// (union за tmdbId??id, list-entry.ts), без merge-діалогу. Конфліктувати можуть
// лише `name`/`description`.

export type ListConflictableField = 'name' | 'description';

export interface ListFieldConflict {
  field: ListConflictableField;
  local: unknown;
  remote: unknown;
}

export type MergeListOutcome =
  | { kind: 'identical' }
  | { kind: 'useLocal' }
  | { kind: 'useRemote' }
  | { kind: 'merged'; item: MediaList }
  | { kind: 'conflict'; base: MediaList; fields: ListFieldConflict[] }
  | { kind: 'deletedVsEdited'; deletedSide: 'local' | 'remote' };

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function eq(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) {
    return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function entryKeyOf(entry: ListEntry): string {
  return entry.tmdbId !== undefined ? `tmdb:${entry.tmdbId}` : `id:${entry.id}`;
}

/** Порядково-незалежне порівняння — union у mergeEntries не гарантує стабільний порядок. */
function entriesEqual(a: ListEntry[], b: ListEntry[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const byKey = new Map(a.map((entry) => [entryKeyOf(entry), entry]));
  return b.every((entry) => eq(byKey.get(entryKeyOf(entry)), entry));
}

function contentEquals(a: MediaList, b: MediaList, includeDeleted = true): boolean {
  const sameFields = eq(a.name, b.name) && eq(a.description, b.description) && entriesEqual(a.entries, b.entries);
  if (!includeDeleted) {
    return sameFields;
  }
  return sameFields && eq(a.deletedAt ?? null, b.deletedAt ?? null);
}

/** Зливає дві версії одного списку (обидві змінені після останнього синку). */
export function mergeLists(local: MediaList, remote: MediaList, nowIso: string): MergeListOutcome {
  const localDeleted = !!local.deletedAt;
  const remoteDeleted = !!remote.deletedAt;

  if (localDeleted && remoteDeleted) {
    return local.updatedAt >= remote.updatedAt ? { kind: 'useLocal' } : { kind: 'useRemote' };
  }
  if (localDeleted !== remoteDeleted) {
    if (contentEquals(local, remote, false)) {
      return localDeleted ? { kind: 'useLocal' } : { kind: 'useRemote' };
    }
    return { kind: 'deletedVsEdited', deletedSide: localDeleted ? 'local' : 'remote' };
  }

  if (contentEquals(local, remote)) {
    return { kind: 'identical' };
  }

  const base: MediaList = {
    id: local.id,
    name: local.name,
    description: local.description,
    entries: mergeEntries(local.entries, remote.entries),
    createdAt: local.createdAt <= remote.createdAt ? local.createdAt : remote.createdAt,
    deletedAt: null,
    updatedAt: nowIso,
  };

  const fields: ListFieldConflict[] = [];

  for (const field of ['name', 'description'] as const) {
    const localValue = local[field];
    const remoteValue = remote[field];
    if (eq(localValue, remoteValue)) {
      (base as unknown as Record<string, unknown>)[field] = localValue;
    } else if (isEmpty(localValue)) {
      (base as unknown as Record<string, unknown>)[field] = remoteValue;
    } else if (isEmpty(remoteValue)) {
      (base as unknown as Record<string, unknown>)[field] = localValue;
    } else {
      fields.push({ field, local: localValue, remote: remoteValue });
    }
  }

  if (fields.length > 0) {
    return { kind: 'conflict', base, fields };
  }

  if (contentEquals(base, local)) {
    return { kind: 'useLocal' };
  }
  if (contentEquals(base, remote)) {
    return { kind: 'useRemote' };
  }
  return { kind: 'merged', item: base };
}

/** deleted-vs-edited для списків: відновити (беремо редагований бік) чи видалити. */
export function resolveListDeletedVsEdited(
  local: MediaList,
  remote: MediaList,
  deletedSide: 'local' | 'remote',
  decision: 'restore' | 'delete',
  nowIso: string,
): MediaList {
  const edited = deletedSide === 'local' ? remote : local;
  if (decision === 'restore') {
    return { ...edited, deletedAt: null, updatedAt: nowIso };
  }
  return { ...edited, deletedAt: nowIso, updatedAt: nowIso };
}
