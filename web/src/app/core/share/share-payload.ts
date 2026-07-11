// Формат шеру (ARCHITECTURE §9). buildPayload/parsePayload — чисті функції
// (без Dexie/Angular), тому легко юніт-тестуються.

import type { CustomLink, MediaItem, MediaKind } from '../models/media-item.model';
import type { ListEntry, ListEntrySnapshot } from '../models/media-list.model';

export interface SharePayload {
  v: 1;
  name: string;
  sharedBy: string;
  entries: ListEntry[];
}

export interface ShareSource {
  name: string;
  entries: ListEntry[];
}

export interface BuildPayloadOptions {
  includeNotes: boolean;
  includeLinks: boolean;
}

/** Резолв entry → айтем бібліотеки відправника (той самий tmdbId/id fallback, що list-detail-page). */
export type EntryResolver = (entry: ListEntry) => MediaItem | null;

/**
 * Знімок списку для шеру. `sharedNotes`/`sharedLinks` НЕ копіюються з entry —
 * це `notes`/`links` айтема відправника (резолв через `resolve`), і лише якщо
 * відповідний чекбокс увімкнено (дефолт — обидва вимкнені). Оцінки й статуси
 * не передаються НІКОЛИ (ARCHITECTURE §9) — їх тут узагалі нема звідки взяти.
 */
export function buildPayload(
  source: ShareSource,
  resolve: EntryResolver,
  sharedBy: string,
  opts: BuildPayloadOptions,
): SharePayload {
  return {
    v: 1,
    name: source.name,
    sharedBy,
    entries: source.entries.map((entry) => {
      const resolved = opts.includeNotes || opts.includeLinks ? resolve(entry) : null;
      return {
        id: entry.id,
        kind: entry.kind,
        tmdbId: entry.tmdbId,
        imdbId: entry.imdbId,
        snapshot: entry.snapshot,
        sharedNotes: opts.includeNotes ? resolved?.notes || undefined : undefined,
        sharedLinks: opts.includeLinks && resolved?.links.length ? resolved.links : undefined,
        addedAt: entry.addedAt,
      };
    }),
  };
}

const MAX_NAME = 300;
const MAX_SHARED_BY = 200;
const MAX_ENTRIES = 1000;
const KINDS = new Set(['movie', 'tv']);

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function parseSnapshot(value: unknown): ListEntrySnapshot | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const snapshot = value as Record<string, unknown>;
  if (!isNonEmptyString(snapshot['title'], 1000)) {
    return null;
  }
  return {
    title: snapshot['title'],
    originalTitle: typeof snapshot['originalTitle'] === 'string' ? snapshot['originalTitle'] : undefined,
    year: typeof snapshot['year'] === 'number' ? snapshot['year'] : undefined,
    posterUrl: typeof snapshot['posterUrl'] === 'string' ? snapshot['posterUrl'] : undefined,
  };
}

/** М'яко пропускає биту одиничну лінку замість того, щоб валити весь payload. */
function parseLinks(value: unknown): CustomLink[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const links: CustomLink[] = [];
  for (const raw of value) {
    const link = raw as Record<string, unknown> | null;
    if (typeof link?.['id'] !== 'string' || typeof link?.['label'] !== 'string' || typeof link?.['url'] !== 'string') {
      continue;
    }
    links.push({ id: link['id'], label: link['label'], url: link['url'] });
  }
  return links.length > 0 ? links : undefined;
}

function parseEntry(raw: unknown): ListEntry | null {
  if (raw === null || typeof raw !== 'object') {
    return null;
  }
  const entry = raw as Record<string, unknown>;

  if (!isNonEmptyString(entry['id'], 200)) {
    return null;
  }
  if (typeof entry['kind'] !== 'string' || !KINDS.has(entry['kind'])) {
    return null;
  }
  const snapshot = parseSnapshot(entry['snapshot']);
  if (!snapshot) {
    return null;
  }
  if (typeof entry['addedAt'] !== 'string') {
    return null;
  }

  return {
    id: entry['id'],
    kind: entry['kind'] as MediaKind,
    tmdbId: typeof entry['tmdbId'] === 'number' ? entry['tmdbId'] : undefined,
    imdbId: typeof entry['imdbId'] === 'string' ? entry['imdbId'] : undefined,
    snapshot,
    sharedNotes: typeof entry['sharedNotes'] === 'string' ? entry['sharedNotes'] : undefined,
    sharedLinks: parseLinks(entry['sharedLinks']),
    addedAt: entry['addedAt'],
  };
}

/**
 * Строга валідація SharePayload — вхід із зовнішнього світу (URL-код або
 * вставлений друзями base64), тому повертає `Error` замість тихого null:
 * викликач мапить конкретний message на людський текст помилки.
 */
export function parsePayload(raw: unknown): SharePayload | Error {
  if (raw === null || typeof raw !== 'object') {
    return new Error('INVALID_SHAPE');
  }
  const body = raw as Record<string, unknown>;

  if (body['v'] !== 1) {
    return new Error('INVALID_VERSION');
  }
  if (!isNonEmptyString(body['name'], MAX_NAME)) {
    return new Error('INVALID_SHAPE');
  }
  if (!isNonEmptyString(body['sharedBy'], MAX_SHARED_BY)) {
    return new Error('INVALID_SHAPE');
  }
  if (!Array.isArray(body['entries']) || body['entries'].length > MAX_ENTRIES) {
    return new Error('INVALID_SHAPE');
  }

  const entries: ListEntry[] = [];
  for (const rawEntry of body['entries']) {
    const entry = parseEntry(rawEntry);
    if (!entry) {
      return new Error('INVALID_SHAPE');
    }
    entries.push(entry);
  }

  return { v: 1, name: body['name'], sharedBy: body['sharedBy'], entries };
}

// --- Офлайн base64url-код (транспорт 2, ARCHITECTURE §9) ---

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padLength = (4 - (value.length % 4)) % 4;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeSharePayload(payload: SharePayload): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/** `null`, якщо рядок не декодується як base64/JSON — parsePayload(null) дає людську помилку далі. */
export function decodeSharePayload(code: string): unknown {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(code));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
