import type { MediaItem } from '../models/media-item.model';
import { classifyChanges, mergeItems, resolveDeletedVsEdited } from './merge';

const NOW = '2026-07-11T12:00:00.000Z';

function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    kind: 'movie',
    status: 'want',
    title: 'Dune',
    links: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('mergeItems', () => {
  it('повертає identical для змістовно однакових версій (навіть з різними updatedAt)', () => {
    const local = item({ myRating: 8 });
    const remote = item({ myRating: 8, updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'identical' });
  });

  it('пусте локально + заповнене в хмарі → useRemote (авто, без конфлікту)', () => {
    const local = item();
    const remote = item({ notes: 'чудовий фільм', updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useRemote' });
  });

  it('заповнене локально + пусте в хмарі → useLocal', () => {
    const local = item({ myRating: 9 });
    const remote = item({ updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useLocal' });
  });

  it('обидва боки мають різні оцінки → конфлікт поля myRating', () => {
    const local = item({ myRating: 8 });
    const remote = item({ myRating: 7 });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.fields).toEqual([{ field: 'myRating', local: 8, remote: 7 }]);
    }
  });

  it('різні статуси → конфлікт поля status', () => {
    const local = item({ status: 'watched' });
    const remote = item({ status: 'dropped' });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.fields.map((f) => f.field)).toEqual(['status']);
    }
  });

  it('нотатки зливаються мовчки (пусте+заповнене), а конфліктна оцінка йде в діалог; base містить злиті нотатки', () => {
    const local = item({ myRating: 8, notes: '' });
    const remote = item({ myRating: 7, notes: 'нотатка з хмари' });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.fields.map((f) => f.field)).toEqual(['myRating']);
      expect(result.base.notes).toBe('нотатка з хмари');
    }
  });

  it('лінки з різними id зливаються union-ом без конфлікту → merged з новим updatedAt', () => {
    const local = item({ links: [{ id: 'a', label: 'Netflix', url: 'https://netflix.com' }], myRating: 8 });
    const remote = item({
      links: [{ id: 'b', label: 'IMDb', url: 'https://imdb.com' }],
      myRating: 8,
      updatedAt: '2026-07-10T05:00:00.000Z',
    });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('merged');
    if (result.kind === 'merged') {
      expect(result.item.links.map((l) => l.id).sort()).toEqual(['a', 'b']);
      expect(result.item.updatedAt).toBe(NOW);
      expect(result.item.myRating).toBe(8);
    }
  });

  it('той самий id лінка з різним url → конфлікт поля links', () => {
    const local = item({ links: [{ id: 'a', label: 'Дивитись', url: 'https://megogo.net' }] });
    const remote = item({ links: [{ id: 'a', label: 'Дивитись', url: 'https://netflix.com' }] });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('conflict');
    if (result.kind === 'conflict') {
      expect(result.fields.map((f) => f.field)).toEqual(['links']);
    }
  });

  it('видалено локально + відредаговано в хмарі → deletedVsEdited', () => {
    const local = item({ deletedAt: '2026-07-10T01:00:00.000Z' });
    const remote = item({ myRating: 9 });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'deletedVsEdited', deletedSide: 'local' });
  });

  it('tombstone без інших відмінностей → видалення перемагає без конфлікту', () => {
    const local = item();
    const remote = item({ deletedAt: '2026-07-10T01:00:00.000Z', updatedAt: '2026-07-10T02:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useRemote' });
  });

  it('видалено з обох боків → перемагає свіжіший tombstone, без конфлікту', () => {
    const local = item({ deletedAt: '2026-07-10T01:00:00.000Z', updatedAt: '2026-07-10T01:00:00.000Z' });
    const remote = item({ deletedAt: '2026-07-09T01:00:00.000Z', updatedAt: '2026-07-09T01:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useLocal' });
  });

  it('різні watchedAt з обох боків → конфлікт; однакові — ні', () => {
    const conflicting = mergeItems(item({ watchedAt: '2026-07-01' }), item({ watchedAt: '2026-07-05' }), NOW);
    expect(conflicting.kind).toBe('conflict');
    const same = mergeItems(item({ watchedAt: '2026-07-01' }), item({ watchedAt: '2026-07-01' }), NOW);
    expect(same.kind).toBe('identical');
  });

  it('метадані НЕ конфліктують: перемагає бік зі свіжішим metadataUpdatedAt', () => {
    const local = item({ title: 'Dune', overview: 'старий опис', metadataUpdatedAt: '2026-07-01T00:00:00.000Z', myRating: 8 });
    const remote = item({ title: 'Дюна', overview: 'новий опис', metadataUpdatedAt: '2026-07-09T00:00:00.000Z', updatedAt: '2026-07-10T05:00:00.000Z', myRating: 8 });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useRemote' });
  });

  it('бік з tmdbId перемагає в метаданих, навіть якщо metadataUpdatedAt старіший (зв\'язування не губиться)', () => {
    const local = item({ tmdbId: 438631, title: 'Дюна', metadataUpdatedAt: '2026-07-01T00:00:00.000Z' });
    const remote = item({ title: 'Dune (manual)', metadataUpdatedAt: '2026-07-09T00:00:00.000Z', updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useLocal' });
  });

  it('метадані з хмари + локальна оцінка зливаються в один айтем (merged)', () => {
    const local = item({ myRating: 9 });
    const remote = item({
      title: 'Дюна',
      overview: 'опис',
      metadataUpdatedAt: '2026-07-09T00:00:00.000Z',
      notes: 'нотатка',
      updatedAt: '2026-07-10T05:00:00.000Z',
    });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('merged');
    if (result.kind === 'merged') {
      expect(result.item.title).toBe('Дюна');
      expect(result.item.myRating).toBe(9);
      expect(result.item.notes).toBe('нотатка');
    }
  });
});

describe('mergeItems — favorite (фікс ревью step-11: губилось у синку)', () => {
  it('зміна лише favorite НЕ вважається identical — favorite-бік перемагає', () => {
    const local = item({ favorite: true });
    const remote = item({ updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'useLocal' });
  });

  it('favorite зливається union-true разом з іншими авто-полями', () => {
    const local = item({ favorite: true });
    const remote = item({ notes: 'нотатка', updatedAt: '2026-07-10T05:00:00.000Z' });
    const result = mergeItems(local, remote, NOW);
    expect(result.kind).toBe('merged');
    if (result.kind === 'merged') {
      expect(result.item.favorite).toBe(true);
      expect(result.item.notes).toBe('нотатка');
    }
  });

  it('favorite: false і undefined — та сама семантика (identical)', () => {
    const local = item({ favorite: false });
    const remote = item({ updatedAt: '2026-07-10T05:00:00.000Z' });
    expect(mergeItems(local, remote, NOW)).toEqual({ kind: 'identical' });
  });
});

describe('classifyChanges', () => {
  it('розкладає зміни на remoteOnly / localOnly / pairs за id', () => {
    const shared = item({ id: '22222222-2222-4222-8222-222222222222' });
    const localOnly = item({ id: '33333333-3333-4333-8333-333333333333' });
    const remoteOnly = item({ id: '44444444-4444-4444-8444-444444444444' });

    const result = classifyChanges([shared, localOnly], [{ ...shared, myRating: 5 }, remoteOnly]);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].local.id).toBe(shared.id);
    expect(result.localOnly.map((i) => i.id)).toEqual([localOnly.id]);
    expect(result.remoteOnly.map((i) => i.id)).toEqual([remoteOnly.id]);
  });
});

describe('resolveDeletedVsEdited', () => {
  const local = item({ deletedAt: '2026-07-10T01:00:00.000Z' });
  const remote = item({ myRating: 9, notes: 'редаговано' });

  it('restore → редагований бік без tombstone, з новим updatedAt', () => {
    const resolved = resolveDeletedVsEdited(local, remote, 'local', 'restore', NOW);
    expect(resolved.deletedAt).toBeNull();
    expect(resolved.myRating).toBe(9);
    expect(resolved.updatedAt).toBe(NOW);
  });

  it('delete → редагований бік з новим tombstone (правки збережені під ним)', () => {
    const resolved = resolveDeletedVsEdited(local, remote, 'local', 'delete', NOW);
    expect(resolved.deletedAt).toBe(NOW);
    expect(resolved.notes).toBe('редаговано');
  });
});
