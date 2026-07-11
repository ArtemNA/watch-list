# WatchList

Персональний local-first список фільмів і серіалів. Angular-фронтенд у [web/](web/),
опційний синк через Vercel Serverless Functions у [api/](api/).

Документація проекту — у [docs/](docs/): [PLAN.md](docs/PLAN.md) (статус кроків),
[ARCHITECTURE.md](docs/ARCHITECTURE.md) (стек, структура, моделі), [DECISIONS.md](docs/DECISIONS.md)
(журнал архітектурних рішень).

## Локальний запуск

Тільки фронтенд (без бекенд-функцій, `/api/*` проксюється на `localhost:3000` і поки що
недоступне):

```bash
npm install
npm start
```

Відкриє `ng serve` на `http://localhost:4200`.

Разом з `api/*`-функціями — два способи:

1. **`api-dev.mjs`** (обрано за замовчуванням, не потребує Vercel-акаунта):

   ```bash
   npm run dev:api   # піднімає api/*.ts на http://localhost:3000
   npm start         # ng serve з проксі /api/* -> :3000
   ```

   Крихітний dev-сервер на `node:http`, викликає ті самі handler-функції
   `api/*.ts` через тонкий адаптер req/res (запускається через `tsx`, бо
   Node сам не виконує TypeScript). Автоматично читає `.env.local`.

2. **`vercel dev`** (альтернатива, потрібен [Vercel CLI](https://vercel.com/docs/cli)):

   ```bash
   npm install
   npx vercel dev
   ```

   Піднімає і статику, і serverless-функції на одному порту (за замовчуванням `:3000`).

Секрети (TMDB/OMDb ключі, MongoDB URI, JWT secret) — у `.env.local` в корені
(див. `.env.example` для переліку змінних). Файл у `.gitignore`, ніколи не комітиться.

## Корисні команди (з кореня)

- `npm run build` — продакшн-білд Angular-апки.
- `npm run lint` — лінт Angular-апки.
- `npm test` — юніт-тести Angular-апки.
- `npm run lint:api` — лінт `api/*.ts`.
- `npm run typecheck:api` — перевірка типів `api/*.ts`.
- `npm run dev:api` — dev-сервер для `api/*.ts` на `:3000` (без Vercel CLI).
