import { mapOmdbToExternalRatings, type OmdbResponse } from './omdb-api.service';

describe('mapOmdbToExternalRatings', () => {
  it('parses IMDb/Rotten Tomatoes/Metacritic from Ratings[]', () => {
    const response: OmdbResponse = {
      Ratings: [
        { Source: 'Internet Movie Database', Value: '8.0/10' },
        { Source: 'Rotten Tomatoes', Value: '83%' },
        { Source: 'Metacritic', Value: '74/100' },
      ],
    };

    expect(mapOmdbToExternalRatings(response)).toEqual({
      imdb: 8.0,
      rottenTomatoes: '83%',
      metacritic: 74,
    });
  });

  it('returns an empty object when Ratings is missing', () => {
    expect(mapOmdbToExternalRatings({})).toEqual({});
  });

  it('returns an empty object when Ratings is an empty array', () => {
    expect(mapOmdbToExternalRatings({ Ratings: [] })).toEqual({});
  });

  it('skips sources with "N/A" values', () => {
    const response: OmdbResponse = {
      Ratings: [
        { Source: 'Internet Movie Database', Value: 'N/A' },
        { Source: 'Rotten Tomatoes', Value: '83%' },
      ],
    };

    expect(mapOmdbToExternalRatings(response)).toEqual({ rottenTomatoes: '83%' });
  });

  it('ignores unknown rating sources', () => {
    const response: OmdbResponse = {
      Ratings: [{ Source: 'Some Other Site', Value: '5/5' }],
    };

    expect(mapOmdbToExternalRatings(response)).toEqual({});
  });
});
