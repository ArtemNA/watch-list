import type { VercelRequest, VercelResponse } from '@vercel/node';

import { TmdbError, tmdbFetch } from './_lib/tmdb';

const EXACT_ALLOWED_PATHS = new Set(['search/multi', 'search/movie', 'search/tv']);
const PREFIX_ALLOWED_PATHS = ['movie/', 'tv/'];

const PASSTHROUGH_PARAMS = ['language', 'query', 'page', 'append_to_response', 'include_adult'];

function isAllowedPath(path: string): boolean {
  if (EXACT_ALLOWED_PATHS.has(path)) {
    return true;
  }
  return PREFIX_ALLOWED_PATHS.some((prefix) => path.startsWith(prefix) && path.length > prefix.length);
}

function cacheControlFor(path: string): string {
  return path.startsWith('search/') ? 's-maxage=300' : 's-maxage=86400';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rawPath = req.query['path'];
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const path = segments.join('/');

  if (!isAllowedPath(path)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const params = new URLSearchParams();
  for (const key of PASSTHROUGH_PARAMS) {
    const value = req.query[key];
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }

  try {
    const data = await tmdbFetch(path, params);
    res.setHeader('Cache-Control', cacheControlFor(path));
    res.status(200).json(data);
  } catch (error) {
    const status = error instanceof TmdbError ? error.status : 502;
    res.status(status).json({ error: 'TMDB request failed' });
  }
}
