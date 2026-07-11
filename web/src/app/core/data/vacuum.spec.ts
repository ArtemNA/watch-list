import type { MediaItem } from '../models/media-item.model';
import { selectVacuumableTombstones } from './vacuum';

const NOW = '2026-07-11T00:00:00.000Z';
const OLD_DELETE = '2026-01-01T00:00:00.000Z'; // > 90 днів до NOW
const OLD_DELETE_AFTER_SYNC = '2026-03-01T00:00:00.000Z'; // теж > 90 днів, але новіше за lastSyncAt нижче
const RECENT_DELETE = '2026-07-05T00:00:00.000Z'; // < 90 днів до NOW

function tombstone(id: string, deletedAt: string | null): MediaItem {
  return {
    id,
    kind: 'movie',
    status: 'watched',
    title: `Item ${id}`,
    links: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: deletedAt ?? '2025-01-01T00:00:00.000Z',
    deletedAt,
  };
}

describe('selectVacuumableTombstones', () => {
  it('лишає айтеми без deletedAt', () => {
    const items = [tombstone('a', null)];
    expect(selectVacuumableTombstones(items, NOW, NOW, false)).toEqual([]);
  });

  it('лишає tombstones молодші за 90 днів, навіть якщо синкнуті', () => {
    const items = [tombstone('a', RECENT_DELETE)];
    expect(selectVacuumableTombstones(items, NOW, NOW, false)).toEqual([]);
  });

  it('НЕ видаляє старий tombstone, якщо lastSyncAt старіший за deletedAt (ще не синкнутий)', () => {
    const items = [tombstone('a', OLD_DELETE)];
    const staleSyncAt = '2025-06-01T00:00:00.000Z'; // до OLD_DELETE
    expect(selectVacuumableTombstones(items, NOW, staleSyncAt, true)).toEqual([]);
  });

  it('НЕ видаляє старий tombstone без lastSyncAt, якщо юзер логінився (можливо ще не синкнув)', () => {
    const items = [tombstone('a', OLD_DELETE)];
    expect(selectVacuumableTombstones(items, NOW, null, true)).toEqual([]);
  });

  it('видаляє старий tombstone, якщо lastSyncAt новіший за deletedAt (підтверджено синкнутий)', () => {
    const items = [tombstone('a', OLD_DELETE)];
    const freshSyncAt = '2026-02-01T00:00:00.000Z'; // після OLD_DELETE
    expect(selectVacuumableTombstones(items, NOW, freshSyncAt, true).map((i) => i.id)).toEqual(['a']);
  });

  it('видаляє старий tombstone без синку, якщо юзер ніколи не логінився', () => {
    const items = [tombstone('a', OLD_DELETE)];
    expect(selectVacuumableTombstones(items, NOW, null, false).map((i) => i.id)).toEqual(['a']);
  });

  it('обробляє мікс кандидатів незалежно один від одного', () => {
    const items = [
      tombstone('keep-recent', RECENT_DELETE),
      tombstone('keep-unsynced', OLD_DELETE_AFTER_SYNC),
      tombstone('vacuum-synced', OLD_DELETE),
    ];
    const lastSyncAt = '2026-02-01T00:00:00.000Z';
    const result = selectVacuumableTombstones(items, NOW, lastSyncAt, true);
    expect(result.map((i) => i.id)).toEqual(['vacuum-synced']);
  });
});
