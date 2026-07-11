const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Проксі-запит до TMDB. Ключ береться з env і ніколи не потрапляє у відповідь.
 * Формат ключа визначається евристично: v4 auth token — це JWT (`eyJ...`),
 * v3 api_key — 32-символьний hex-рядок; перший передається як Bearer,
 * другий — як query-параметр `api_key`.
 */
export async function tmdbFetch(path: string, params: URLSearchParams): Promise<unknown> {
  const apiKey = process.env['TMDB_API_KEY'];
  if (!apiKey) {
    throw new TmdbError('TMDB_API_KEY is not configured', 500);
  }

  const url = new URL(`${TMDB_BASE_URL}/${path}`);
  params.forEach((value, key) => url.searchParams.set(key, value));

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set('api_key', apiKey);
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new TmdbError(`TMDB responded with ${response.status}`, response.status);
  }
  return response.json();
}
