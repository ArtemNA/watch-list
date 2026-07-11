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

Разом з `api/*`-функціями (потрібен [Vercel CLI](https://vercel.com/docs/cli)):

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
