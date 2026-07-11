import type { VercelRequest, VercelResponse } from '@vercel/node';

import { OmdbError, omdbFetch } from './_lib/omdb';

const IMDB_ID_PATTERN = /^tt\d+$/;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const rawId = req.query['i'];
  const id = typeof rawId === 'string' ? rawId : undefined;

  if (!id || !IMDB_ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Invalid imdb id' });
    return;
  }

  try {
    const data = await omdbFetch(id);
    res.setHeader('Cache-Control', 's-maxage=86400');
    res.status(200).json(data);
  } catch (error) {
    const status = error instanceof OmdbError ? error.status : 502;
    res.status(status).json({ error: 'OMDb request failed' });
  }
}
