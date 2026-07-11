const OMDB_BASE_URL = 'https://www.omdbapi.com/';

export class OmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Проксі-запит до OMDb по imdbId. Ключ береться з env і ніколи не потрапляє у відповідь. */
export async function omdbFetch(imdbId: string): Promise<unknown> {
  const apiKey = process.env['OMDB_API_KEY'];
  if (!apiKey) {
    throw new OmdbError('OMDB_API_KEY is not configured', 500);
  }

  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set('i', imdbId);
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new OmdbError(`OMDb responded with ${response.status}`, response.status);
  }
  return response.json();
}
