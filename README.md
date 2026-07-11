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
- `npm run test:api` — юніт-тести `api/*.ts`.
- `npm run dev:api` — dev-сервер для `api/*.ts` на `:3000` (без Vercel CLI).

## Деплой на Vercel

Один репозиторій → один Vercel-проект (фронт як static output + `api/*.ts` як
serverless-функції), конфіг уже готовий у `vercel.json` (`buildCommand`,
`outputDirectory: web/dist/web/browser`, SPA-rewrite на `index.html`).

1. **Atlas: дозволити доступ з Vercel.** Serverless-функції запускаються з
   непередбачуваних IP, тому в MongoDB Atlas → Network Access додай
   `0.0.0.0/0` (Allow access from anywhere). Це прийнятно для персонального
   проекту з окремим БД-юзером (не адмін) і паролем, який більше ніде не
   використовується.
2. **Імпорт репозиторію у Vercel:**
   - [vercel.com/new](https://vercel.com/new) → Import Git Repository → обрати
     цей репозиторій (потрібен push у GitHub/GitLab/Bitbucket).
   - Framework Preset: Vercel зазвичай сам розпізнає `vercel.json`; якщо
     запитає — Other/без пресету, білд-команду і output directory брати з
     `vercel.json` (нічого руками міняти не треба).
   - Root Directory лишити кореневим (не `web/`) — і `api/`, і `web/`
     мають бути в одному деплої.
3. **Env vars** (Project Settings → Environment Variables), значення — з
   локального `.env.local` (список — `.env.example`):
   - `TMDB_API_KEY`
   - `OMDB_API_KEY`
   - `MONGODB_URI`
   - `JWT_SECRET`

   Додати для Production (і Preview, якщо будуть перевірятись PR-деплої).
4. **Deploy.** Перший деплой запускається автоматично після імпорту; наступні —
   на кожен push у гілку, підключену як Production (зазвичай `main`).
5. **Перевірка прод-деплою:**
   - `https://<project>.vercel.app/api/health` → `{ ok: true, ts: ... }`.
   - Відкрити сайт, зареєструвати тестового юзера (`/auth`), перевірити, що
     в MongoDB Atlas (колекція `users`) з'явився запис з `passwordHash`
     (не plain-текстом).
   - Пошук фільму на `/search` (перевіряє `TMDB_API_KEY` на бекенді).
   - Додати айтем у бібліотеку, зайти під тим самим юзером з іншого
     пристрою/браузера, натиснути на індикатор синку в хедері — айтем має
     з'явитись.
   - PWA: на телефоні відкрити сайт у Chrome/Safari → «Додати на головний
     екран»; вимкнути мережу (airplane mode) → бібліотека і редагування досі
     працюють, пошук показує «Пошук недоступний офлайн».
   - Lighthouse (Chrome DevTools) на проді: PWA installable, Performance ≥ 85
     на сторінці бібліотеки.
