import type { CustomLink, MediaItem } from '../models/media-item.model';

// Чиста merge-логіка синку (ARCHITECTURE.md §6). Без Angular/Dexie —
// максимум юніт-тестів. Головний інваріант: ЖОДНІ дані юзера не губляться мовчки.

/** Поля «моїх даних», конфлікти яких вирішує юзер у merge-діалозі. */
export type ConflictableField = 'status' | 'myRating' | 'notes' | 'watchedAt' | 'links';

export interface FieldConflict {
  field: ConflictableField;
  local: unknown;
  remote: unknown;
}

export type MergeOutcome =
  /** Версії змістовно однакові — нічого не робити. */
  | { kind: 'identical' }
  /** Злитий результат = локальна версія → тільки push на сервер. */
  | { kind: 'useLocal' }
  /** Злитий результат = хмарна версія → тільки застосувати локально. */
  | { kind: 'useRemote' }
  /** Авто-злиття без питань (пусте+заповнене, union лінків) → застосувати і запушити. */
  | { kind: 'merged'; item: MediaItem }
  /** Потрібен юзер: base — айтем з уже злитими безконфліктними полями. */
  | { kind: 'conflict'; base: MediaItem; fields: FieldConflict[] }
  /** З одного боку видалено, з іншого — редаговано: юзер обирає відновити чи видалити. */
  | { kind: 'deletedVsEdited'; deletedSide: 'local' | 'remote' };

// ---------------------------------------------------------------------------

/** Порівняння значень полів: undefined === null === '' (відсутність значення). */
function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function eq(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) {
    return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Метадані йдуть одним блоком: конфлікти між ними безглузді — обидві версії з TMDB. */
const METADATA_FIELDS = [
  'kind',
  'tmdbId',
  'imdbId',
  'title',
  'originalTitle',
  'titleUk',
  'year',
  'posterUrl',
  'overview',
  'genres',
  'runtime',
  'externalRatings',
  'watchProviders',
  'metadataUpdatedAt',
  'metadataLang',
] as const;

const USER_FIELDS: ConflictableField[] = ['status', 'myRating', 'notes', 'watchedAt', 'links'];

/**
 * Чий блок метаданих брати: якщо tmdbId є лише з одного боку — той бік
 * (зв'язування з TMDB не має губитись через свіжіший refresh на іншому пристрої),
 * інакше — свіжіший metadataUpdatedAt, а без нього — свіжіший updatedAt.
 */
function metadataSource(local: MediaItem, remote: MediaItem): MediaItem {
  const localHasTmdb = local.tmdbId !== undefined;
  const remoteHasTmdb = remote.tmdbId !== undefined;
  if (localHasTmdb !== remoteHasTmdb) {
    return localHasTmdb ? local : remote;
  }
  const localMeta = local.metadataUpdatedAt ?? '';
  const remoteMeta = remote.metadataUpdatedAt ?? '';
  if (localMeta !== remoteMeta) {
    return localMeta > remoteMeta ? local : remote;
  }
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

/**
 * Union лінків за id. Повертає null, якщо той самий id має різний зміст
 * з двох боків — це конфлікт, який мусить вирішити юзер.
 * Побічний ефект union: лінк, видалений на одному пристрої, «воскресне» —
 * прийнятний компроміс без пер-лінкових tombstones (нічого не губимо).
 */
function mergeLinks(local: CustomLink[], remote: CustomLink[]): CustomLink[] | null {
  const byId = new Map<string, CustomLink>(local.map((link) => [link.id, link]));
  const merged = [...local];
  for (const link of remote) {
    const existing = byId.get(link.id);
    if (!existing) {
      merged.push(link);
      continue;
    }
    if (existing.label !== link.label || existing.url !== link.url) {
      return null;
    }
  }
  return merged;
}

/** Рівність метаданих + «моїх даних». deletedAt порівнюється лише якщо includeDeleted. */
function contentEquals(a: MediaItem, b: MediaItem, includeDeleted = true): boolean {
  const sameFields =
    METADATA_FIELDS.every((field) => eq(a[field], b[field])) &&
    USER_FIELDS.every((field) => eq(a[field], b[field]));
  if (!includeDeleted) {
    return sameFields;
  }
  return sameFields && eq(a.deletedAt ?? null, b.deletedAt ?? null);
}

// ---------------------------------------------------------------------------

/**
 * Зливає дві версії одного айтема (обидві змінені після останнього синку).
 * `nowIso` передається зовні, щоб функція лишалась чистою.
 */
export function mergeItems(local: MediaItem, remote: MediaItem, nowIso: string): MergeOutcome {
  const localDeleted = !!local.deletedAt;
  const remoteDeleted = !!remote.deletedAt;

  if (localDeleted && remoteDeleted) {
    // Видалено з обох боків — суперечки нема, лишаємо свіжішу версію tombstone.
    return local.updatedAt >= remote.updatedAt ? { kind: 'useLocal' } : { kind: 'useRemote' };
  }
  if (localDeleted !== remoteDeleted) {
    if (contentEquals(local, remote, false)) {
      // Єдина відмінність — сам tombstone (наприклад, видалення ще не долетіло):
      // це не «правки проти видалення», конфлікту нема — видалення перемагає.
      return localDeleted ? { kind: 'useLocal' } : { kind: 'useRemote' };
    }
    return { kind: 'deletedVsEdited', deletedSide: localDeleted ? 'local' : 'remote' };
  }

  if (contentEquals(local, remote)) {
    return { kind: 'identical' };
  }

  // Base: метадані — одним блоком від «кращого» джерела; createdAt — найраніший.
  const metaSource = metadataSource(local, remote);
  const base: MediaItem = {
    ...metaSource,
    id: local.id,
    createdAt: local.createdAt <= remote.createdAt ? local.createdAt : remote.createdAt,
    deletedAt: null,
    updatedAt: nowIso,
  };

  const fields: FieldConflict[] = [];

  for (const field of ['status', 'myRating', 'notes', 'watchedAt'] as const) {
    const localValue = local[field];
    const remoteValue = remote[field];
    if (eq(localValue, remoteValue)) {
      (base as unknown as Record<string, unknown>)[field] = localValue;
    } else if (isEmpty(localValue)) {
      // Пусте проти заповненого — НЕ конфлікт: мовчки беремо заповнене.
      (base as unknown as Record<string, unknown>)[field] = remoteValue;
    } else if (isEmpty(remoteValue)) {
      (base as unknown as Record<string, unknown>)[field] = localValue;
    } else {
      fields.push({ field, local: localValue, remote: remoteValue });
    }
  }

  const mergedLinks = mergeLinks(local.links ?? [], remote.links ?? []);
  if (mergedLinks === null) {
    fields.push({ field: 'links', local: local.links, remote: remote.links });
    base.links = local.links;
  } else {
    base.links = mergedLinks;
  }

  if (fields.length > 0) {
    return { kind: 'conflict', base, fields };
  }

  // Авто-злиття вдалося. Якщо результат збігається з одним із боків — не плодимо
  // нову версію (updatedAt), а просто беремо той бік.
  if (contentEquals(base, local)) {
    return { kind: 'useLocal' };
  }
  if (contentEquals(base, remote)) {
    return { kind: 'useRemote' };
  }
  return { kind: 'merged', item: base };
}

// ---------------------------------------------------------------------------

export interface ChangePair {
  local: MediaItem;
  remote: MediaItem;
}

export interface Classified {
  /** Є лише в хмарі — застосувати локально без питань. */
  remoteOnly: MediaItem[];
  /** Є лише локально — запушити без питань. */
  localOnly: MediaItem[];
  /** Змінені з обох боків — через mergeItems. */
  pairs: ChangePair[];
}

/** Розкладає зміни з двох боків по кошиках за id. Чиста функція. */
export function classifyChanges(localChanged: MediaItem[], remoteChanged: MediaItem[]): Classified {
  const remoteById = new Map(remoteChanged.map((item) => [item.id, item]));
  const localIds = new Set(localChanged.map((item) => item.id));

  const pairs: ChangePair[] = [];
  const localOnly: MediaItem[] = [];
  for (const local of localChanged) {
    const remote = remoteById.get(local.id);
    if (remote) {
      pairs.push({ local, remote });
    } else {
      localOnly.push(local);
    }
  }
  const remoteOnly = remoteChanged.filter((item) => !localIds.has(item.id));

  return { remoteOnly, localOnly, pairs };
}

/** Рішення юзера по deleted-vs-edited: відновити (беремо редагований бік) чи видалити. */
export function resolveDeletedVsEdited(
  local: MediaItem,
  remote: MediaItem,
  deletedSide: 'local' | 'remote',
  decision: 'restore' | 'delete',
  nowIso: string,
): MediaItem {
  const edited = deletedSide === 'local' ? remote : local;
  if (decision === 'restore') {
    return { ...edited, deletedAt: null, updatedAt: nowIso };
  }
  return { ...edited, deletedAt: nowIso, updatedAt: nowIso };
}
