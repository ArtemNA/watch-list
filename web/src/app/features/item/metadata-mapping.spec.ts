import type { TmdbDetails } from '../../core/api/tmdb-api.service';
import type { MediaItem } from '../../core/models/media-item.model';
import { extractWatchProviders, mapDetailsToMetadataPatch, shouldRefreshMetadata } from './metadata-mapping';

function baseDetails(overrides: Partial<TmdbDetails> = {}): TmdbDetails {
  return {
    id: 438631,
    title: 'Дюна',
    original_title: 'Dune',
    release_date: '2021-09-15',
    poster_path: '/poster.jpg',
    overview: 'Опис',
    genres: [{ id: 1, name: 'Фантастика' }],
    runtime: 155,
    vote_average: 7.8,
    external_ids: { imdb_id: 'tt1160419' },
    translations: { translations: [{ iso_639_1: 'uk', data: { title: 'Дюна' } }] },
    ...overrides,
  };
}

function baseItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: '1',
    kind: 'movie',
    status: 'want',
    title: 'Дюна',
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mapDetailsToMetadataPatch', () => {
  it('maps TMDB fields, tmdb rating and metadataLang, and stamps metadataUpdatedAt', () => {
    const patch = mapDetailsToMetadataPatch(baseDetails(), 'movie', 'uk');

    expect(patch).toMatchObject({
      title: 'Дюна',
      originalTitle: 'Dune',
      titleUk: 'Дюна',
      year: 2021,
      overview: 'Опис',
      genres: ['Фантастика'],
      runtime: 155,
      imdbId: 'tt1160419',
      externalRatings: { tmdb: 7.8 },
      metadataLang: 'uk',
    });
    expect(patch.metadataUpdatedAt).toEqual(expect.any(String));
  });

  it('omits externalRatings when TMDB has no vote_average', () => {
    const patch = mapDetailsToMetadataPatch(baseDetails({ vote_average: undefined }), 'movie', 'en');
    expect(patch.externalRatings).toBeUndefined();
  });
});

describe('extractWatchProviders', () => {
  const providers = {
    logo_path: '/logo.png',
    provider_id: 8,
    provider_name: 'Netflix',
  };

  it('returns undefined when there is no watch/providers data', () => {
    expect(extractWatchProviders(baseDetails())).toBeUndefined();
  });

  it('prefers the UA region', () => {
    const details = baseDetails({
      'watch/providers': {
        results: {
          UA: { link: 'https://ua.link', flatrate: [{ ...providers, display_priority: 1 }] },
          US: { link: 'https://us.link', flatrate: [{ ...providers, provider_name: 'Hulu', display_priority: 1 }] },
        },
      },
    });

    const result = extractWatchProviders(details);

    expect(result?.link).toBe('https://ua.link');
    expect(result?.flatrate?.[0]).toEqual({
      providerId: 8,
      providerName: 'Netflix',
      logoUrl: 'https://image.tmdb.org/t/p/w92/logo.png',
    });
  });

  it('falls back to US when there is no UA region', () => {
    const details = baseDetails({
      'watch/providers': {
        results: { US: { link: 'https://us.link', rent: [providers] } },
      },
    });

    const result = extractWatchProviders(details);

    expect(result?.link).toBe('https://us.link');
    expect(result?.rent?.[0].providerName).toBe('Netflix');
  });

  it('returns undefined when the matched region has no flatrate/rent/buy entries', () => {
    const details = baseDetails({ 'watch/providers': { results: { UA: { link: 'https://ua.link' } } } });

    expect(extractWatchProviders(details)).toBeUndefined();
  });

  it('sorts providers by display_priority', () => {
    const details = baseDetails({
      'watch/providers': {
        results: {
          UA: {
            flatrate: [
              { ...providers, provider_name: 'Second', display_priority: 2 },
              { ...providers, provider_name: 'First', display_priority: 1 },
            ],
          },
        },
      },
    });

    const result = extractWatchProviders(details);

    expect(result?.flatrate?.map((p) => p.providerName)).toEqual(['First', 'Second']);
  });
});

describe('shouldRefreshMetadata', () => {
  const now = new Date('2026-07-11T00:00:00.000Z').getTime();

  it('is false when the item has no tmdbId', () => {
    expect(shouldRefreshMetadata(baseItem(), 'uk', now)).toBe(false);
  });

  it('is true when metadataUpdatedAt is missing', () => {
    expect(shouldRefreshMetadata(baseItem({ tmdbId: 1 }), 'uk', now)).toBe(true);
  });

  it('is true when metadataLang differs from the current UI language', () => {
    const item = baseItem({ tmdbId: 1, metadataLang: 'en', metadataUpdatedAt: new Date(now).toISOString() });
    expect(shouldRefreshMetadata(item, 'uk', now)).toBe(true);
  });

  it('is true when metadataUpdatedAt is older than 7 days', () => {
    const eightDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString();
    const item = baseItem({ tmdbId: 1, metadataLang: 'uk', metadataUpdatedAt: eightDaysAgo });
    expect(shouldRefreshMetadata(item, 'uk', now)).toBe(true);
  });

  it('is false when metadataUpdatedAt is fresh and lang matches', () => {
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const item = baseItem({ tmdbId: 1, metadataLang: 'uk', metadataUpdatedAt: yesterday });
    expect(shouldRefreshMetadata(item, 'uk', now)).toBe(false);
  });
});
