import { describe, expect, it } from 'vitest';

import { sanitizeSyncItem } from './sync-validate';

function baseItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'movie',
    status: 'want',
    title: 'Дюна',
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sanitizeSyncItem — metadataLang (Step 10)', () => {
  it('accepts metadataLang: ru', () => {
    const result = sanitizeSyncItem(baseItem({ metadataLang: 'ru' }));

    expect(result).not.toBeNull();
    expect(result?.metadataLang).toBe('ru');
  });

  it('still accepts uk and en', () => {
    expect(sanitizeSyncItem(baseItem({ metadataLang: 'uk' }))?.metadataLang).toBe('uk');
    expect(sanitizeSyncItem(baseItem({ metadataLang: 'en' }))?.metadataLang).toBe('en');
  });

  it('drops an unknown metadataLang instead of rejecting the whole item', () => {
    const result = sanitizeSyncItem(baseItem({ metadataLang: 'fr' }));

    expect(result).not.toBeNull();
    expect(result?.metadataLang).toBeUndefined();
  });
});
