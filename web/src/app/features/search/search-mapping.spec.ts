import type { TmdbDetails, TmdbSearchItem } from '../../core/api/tmdb-api.service';
import {
  dedupeSearchItems,
  languageForUi,
  mapDetailsToNewItem,
  mapSearchItem,
  mergeSearchItems,
} from './search-mapping';

function searchItem(overrides: Partial<TmdbSearchItem>): TmdbSearchItem {
  return {
    id: 1,
    media_type: 'movie',
    ...overrides,
  };
}

describe('languageForUi', () => {
  it('maps uk to uk-UA', () => {
    expect(languageForUi('uk')).toBe('uk-UA');
  });

  it('maps en to en-US', () => {
    expect(languageForUi('en')).toBe('en-US');
  });
});

describe('dedupeSearchItems', () => {
  it('filters out non movie/tv media types (e.g. person)', () => {
    const items = [
      searchItem({ id: 1, media_type: 'movie' }),
      searchItem({ id: 2, media_type: 'person' }),
      searchItem({ id: 3, media_type: 'tv' }),
    ];

    const result = dedupeSearchItems(items);

    expect(result.map((i) => i.id)).toEqual([1, 3]);
  });

  it('dedupes by (media_type, id) keeping the first occurrence and original order', () => {
    const items = [
      searchItem({ id: 1, media_type: 'movie', title: 'First' }),
      searchItem({ id: 1, media_type: 'tv' }),
      searchItem({ id: 1, media_type: 'movie', title: 'Duplicate' }),
      searchItem({ id: 2, media_type: 'movie' }),
    ];

    const result = dedupeSearchItems(items);

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('First');
    expect(result.map((i) => `${i.media_type}:${i.id}`)).toEqual(['movie:1', 'tv:1', 'movie:2']);
  });
});

describe('mergeSearchItems', () => {
  it('appends only items not already present, preserving existing order', () => {
    const existing = [searchItem({ id: 1, media_type: 'movie' }), searchItem({ id: 2, media_type: 'tv' })];
    const incoming = [searchItem({ id: 2, media_type: 'tv' }), searchItem({ id: 3, media_type: 'movie' })];

    const result = mergeSearchItems(existing, incoming);

    expect(result.map((i) => `${i.media_type}:${i.id}`)).toEqual(['movie:1', 'tv:2', 'movie:3']);
  });
});

describe('mapSearchItem', () => {
  it('maps a movie result using title/original_title/release_date', () => {
    const item = searchItem({
      id: 438631,
      media_type: 'movie',
      title: 'Дюна',
      original_title: 'Dune',
      release_date: '2021-09-15',
      poster_path: '/poster.jpg',
      vote_average: 7.8,
    });

    const result = mapSearchItem(item);

    expect(result).toEqual({
      id: 438631,
      kind: 'movie',
      title: 'Дюна',
      originalTitle: 'Dune',
      year: 2021,
      posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      voteAverage: 7.8,
    });
  });

  it('maps a tv result using name/original_name/first_air_date', () => {
    const item = searchItem({
      id: 90228,
      media_type: 'tv',
      name: 'Дюна: Пророцтво',
      original_name: 'Dune: Prophecy',
      first_air_date: '2024-11-17',
    });

    const result = mapSearchItem(item);

    expect(result.kind).toBe('tv');
    expect(result.title).toBe('Дюна: Пророцтво');
    expect(result.originalTitle).toBe('Dune: Prophecy');
    expect(result.year).toBe(2024);
  });

  it('omits originalTitle when it is identical to the localized title', () => {
    const item = searchItem({ title: 'Dune', original_title: 'Dune' });

    expect(mapSearchItem(item).originalTitle).toBeUndefined();
  });

  it('leaves posterUrl and year undefined when TMDB has no poster/release date', () => {
    const item = searchItem({ title: 'Untitled' });

    const result = mapSearchItem(item);

    expect(result.posterUrl).toBeUndefined();
    expect(result.year).toBeUndefined();
  });
});

describe('mapDetailsToNewItem', () => {
  function movieDetails(overrides: Partial<TmdbDetails> = {}): TmdbDetails {
    return {
      id: 438631,
      title: 'Дюна',
      original_title: 'Dune',
      release_date: '2021-09-15',
      poster_path: '/poster.jpg',
      overview: 'Опис',
      genres: [{ id: 1, name: 'Фантастика' }, { id: 2, name: 'Пригоди' }],
      runtime: 155,
      vote_average: 7.8,
      external_ids: { imdb_id: 'tt1160419' },
      translations: { translations: [{ iso_639_1: 'uk', data: { title: 'Дюна' } }] },
      ...overrides,
    };
  }

  it('maps a movie into a new-item input with status "want"', () => {
    const result = mapDetailsToNewItem(movieDetails(), 'movie');

    expect(result).toMatchObject({
      kind: 'movie',
      status: 'want',
      tmdbId: 438631,
      imdbId: 'tt1160419',
      title: 'Дюна',
      originalTitle: 'Dune',
      titleUk: 'Дюна',
      year: 2021,
      posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      overview: 'Опис',
      genres: ['Фантастика', 'Пригоди'],
      runtime: 155,
      externalRatings: { tmdb: 7.8 },
    });
    expect(result.metadataUpdatedAt).toEqual(expect.any(String));
  });

  it('maps a tv show using name/original_name/first_air_date/episode_run_time', () => {
    const details = movieDetails({
      title: undefined,
      original_title: undefined,
      release_date: undefined,
      name: 'Дюна: Пророцтво',
      original_name: 'Dune: Prophecy',
      first_air_date: '2024-11-17',
      runtime: undefined,
      episode_run_time: [60, 55],
      translations: { translations: [{ iso_639_1: 'uk', data: { name: 'Дюна: Пророцтво' } }] },
    });

    const result = mapDetailsToNewItem(details, 'tv');

    expect(result.title).toBe('Дюна: Пророцтво');
    expect(result.originalTitle).toBe('Dune: Prophecy');
    expect(result.year).toBe(2024);
    expect(result.runtime).toBe(60);
    expect(result.titleUk).toBe('Дюна: Пророцтво');
  });

  it('omits imdbId/titleUk when TMDB does not provide them', () => {
    const details = movieDetails({ external_ids: undefined, translations: undefined });

    const result = mapDetailsToNewItem(details, 'movie');

    expect(result.imdbId).toBeUndefined();
    expect(result.titleUk).toBeUndefined();
  });
});
