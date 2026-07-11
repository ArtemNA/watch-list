// Крихітний dev-сервер для api/*.ts — альтернатива `vercel dev` (не потрібен Vercel-акаунт).
// Запуск: `npm run dev:api` (з кореня), потім `npm start` для Angular з проксі на цей порт.
// Викликає ті самі handler-функції, що й у продакшні на Vercel, через тонкий адаптер
// node:http req/res -> VercelRequest/VercelResponse.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

function loadEnvLocal() {
  let content;
  try {
    content = readFileSync(new URL('./.env.local', import.meta.url), 'utf8');
  } catch {
    return;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function toVercelResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };
  return res;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function main() {
  loadEnvLocal();

  // На Vercel /api/tmdb/* → rewrite на api/tmdb-proxy.ts (catch-all [...path]
  // у zero-config API-роутах не матеріалізувався на проді — див. vercel.json).
  const tmdbHandler = (await import('./api/tmdb-proxy.ts')).default;
  const omdbHandler = (await import('./api/omdb.ts')).default;
  const healthHandler = (await import('./api/health.ts')).default;
  const registerHandler = (await import('./api/auth/register.ts')).default;
  const loginHandler = (await import('./api/auth/login.ts')).default;
  const syncItemsHandler = (await import('./api/sync/items.ts')).default;

  const port = Number(process.env['PORT']) || 3000;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const query = Object.fromEntries(url.searchParams.entries());
    res = toVercelResponse(res);

    if (url.pathname === '/api/health') {
      req.query = query;
      void healthHandler(req, res);
      return;
    }

    if (url.pathname.startsWith('/api/tmdb/')) {
      const path = url.pathname.slice('/api/tmdb/'.length).split('/').filter(Boolean);
      req.query = { ...query, path };
      void tmdbHandler(req, res);
      return;
    }

    if (url.pathname === '/api/omdb') {
      req.query = query;
      void omdbHandler(req, res);
      return;
    }

    if (url.pathname === '/api/sync/items') {
      req.query = query;
      if (req.method === 'POST') {
        try {
          req.body = await readJsonBody(req);
        } catch {
          res.status(400).json({ error: 'INVALID_JSON' });
          return;
        }
      }
      void syncItemsHandler(req, res);
      return;
    }

    if (url.pathname === '/api/auth/register' || url.pathname === '/api/auth/login') {
      req.query = query;
      try {
        req.body = await readJsonBody(req);
      } catch {
        res.status(400).json({ error: 'INVALID_JSON' });
        return;
      }
      const handler = url.pathname === '/api/auth/register' ? registerHandler : loginHandler;
      void handler(req, res);
      return;
    }

    res.status(404).json({ error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`api-dev listening on http://localhost:${port}`);
  });
}

void main();
