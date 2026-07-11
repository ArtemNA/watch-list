import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import type { TmdbDetails } from '../../core/api/tmdb-api.service';
import { OmdbApiService } from '../../core/api/omdb-api.service';
import { TmdbApiService } from '../../core/api/tmdb-api.service';
import { PreviewService } from './preview.service';

function baseDetails(overrides: Partial<TmdbDetails> = {}): TmdbDetails {
  return {
    id: 438631,
    title: 'Дюна',
    original_title: 'Dune',
    release_date: '2021-09-15',
    poster_path: '/poster.jpg',
    overview: 'Опис',
    genres: [{ id: 1, name: 'Фантастика' }],
    vote_average: 7.8,
    external_ids: { imdb_id: 'tt1160419' },
    ...overrides,
  };
}

describe('PreviewService', () => {
  let getDetailsSpy: ReturnType<typeof vi.fn>;
  let getRatingsSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getDetailsSpy = vi.fn().mockReturnValue(of(baseDetails()));
    getRatingsSpy = vi.fn().mockReturnValue(of({ imdb: 8.0, rottenTomatoes: '83%', metacritic: 74 }));

    TestBed.configureTestingModule({
      providers: [
        { provide: TmdbApiService, useValue: { getDetails: getDetailsSpy } },
        { provide: OmdbApiService, useValue: { getRatings: getRatingsSpy } },
      ],
    });
  });

  it('fetches TMDB details (localized) and merges OMDb ratings by imdbId', async () => {
    const service = TestBed.inject(PreviewService);

    const data = await service.load('movie', 438631, 'uk');

    expect(data.title).toBe('Дюна');
    expect(data.imdbId).toBe('tt1160419');
    expect(data.externalRatings).toEqual({ tmdb: 7.8, imdb: 8.0, rottenTomatoes: '83%', metacritic: 74 });
    expect(getDetailsSpy).toHaveBeenCalledWith('movie', 438631, 'uk-UA');
    expect(getRatingsSpy).toHaveBeenCalledWith('tt1160419');
  });

  it('never touches OMDb when TMDB has no imdbId', async () => {
    getDetailsSpy.mockReturnValue(of(baseDetails({ external_ids: undefined })));
    const service = TestBed.inject(PreviewService);

    const data = await service.load('movie', 438631, 'uk');

    expect(data.externalRatings).toEqual({ tmdb: 7.8 });
    expect(getRatingsSpy).not.toHaveBeenCalled();
  });

  it('silently ignores an OMDb failure and keeps only the TMDB rating', async () => {
    getRatingsSpy.mockReturnValue(throwError(() => new Error('omdb down')));
    const service = TestBed.inject(PreviewService);

    const data = await service.load('movie', 438631, 'uk');

    expect(data.externalRatings).toEqual({ tmdb: 7.8 });
  });

  it('caches by kind:id:lang — a second call for the same key does not refetch', async () => {
    const service = TestBed.inject(PreviewService);

    await service.load('movie', 438631, 'uk');
    await service.load('movie', 438631, 'uk');

    expect(getDetailsSpy).toHaveBeenCalledOnce();
  });

  it('treats a different language as a different cache key', async () => {
    const service = TestBed.inject(PreviewService);

    await service.load('movie', 438631, 'uk');
    await service.load('movie', 438631, 'en');

    expect(getDetailsSpy).toHaveBeenCalledTimes(2);
  });

  it('treats a different kind for the same tmdbId as a different cache key', async () => {
    const service = TestBed.inject(PreviewService);

    await service.load('movie', 438631, 'uk');
    await service.load('tv', 438631, 'uk');

    expect(getDetailsSpy).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed fetch — a later call retries instead of replaying the rejection', async () => {
    getDetailsSpy.mockReturnValueOnce(throwError(() => new Error('network down')));
    const service = TestBed.inject(PreviewService);

    await expect(service.load('movie', 438631, 'uk')).rejects.toThrow('network down');

    getDetailsSpy.mockReturnValue(of(baseDetails()));
    const data = await service.load('movie', 438631, 'uk');

    expect(data.title).toBe('Дюна');
    expect(getDetailsSpy).toHaveBeenCalledTimes(2);
  });
});
