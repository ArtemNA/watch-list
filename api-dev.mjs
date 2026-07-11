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

async function main() {
  loadEnvLocal();

  const tmdbHandler = (await import('./api/tmdb/[...path].ts')).default;
  const healthHandler = (await import('./api/health.ts')).default;

  const port = Number(process.env['PORT']) || 3000;

  const server = createServer((req, res) => {
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

    res.status(404).json({ error: 'Not found' });
  });

  server.listen(port, () => {
    console.log(`api-dev listening on http://localhost:${port}`);
  });
}

void main();
