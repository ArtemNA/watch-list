# Step 01 — Скаффолд проекту

**Передумови:** немає (перший крок). Прочитай `CLAUDE.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md` §1.

## Мета

Порожній, але робочий каркас: Angular-апка в `web/`, папка `api/` з однією
тестовою функцією, лінтери, git, Vercel-конфіг. Після цього кроку `npm start`
показує пусту сторінку-заглушку, `npm run build` проходить.

## Завдання

1. `git init` в корені; `.gitignore` (node_modules, dist, .env*, .vercel, .angular).
2. Згенерувати Angular-апку **останньої стабільної версії** в `web/`:
   `ng new` зі standalone-компонентами, роутингом, SCSS, без SSR (`--ssr=false`).
   Zoneless — якщо стабільний у поточній версії CLI, інакше zone.js (задокументуй вибір).
3. Кореневий `package.json` зі скриптами-оркестраторами:
   - `start` → `ng serve` в web/ з `--proxy-config proxy.conf.json` (проксі `/api` → `http://localhost:3000`),
   - `build` → білд Angular,
   - `lint`, `test` → відповідні команди web/.
4. `api/health.ts` — Vercel-функція, повертає `{ ok: true, ts: <ISO> }`.
   Встановити `@vercel/node` (types). Створити `api/_lib/.gitkeep`.
5. `vercel.json`: Angular static build з `web/dist/...`, rewrites: всі не-`/api`
   шляхи → `index.html` (SPA fallback).
6. ESLint (angular-eslint) + Prettier у web/ і api/. Формат: single quotes, semi, 100 cols.
7. Структура папок з ARCHITECTURE.md §1: створити `web/src/app/{core,shared,features,design}`
   з `.gitkeep`. Роут `/` → тимчасовий `ShellComponent` з текстом "WatchList".
8. `.env.example` в корені з іменами всіх майбутніх змінних (без значень):
   `TMDB_API_KEY`, `OMDB_API_KEY`, `MONGODB_URI`, `JWT_SECRET`.
9. `README.md`: як запустити локально (`npm i`, `npm start`; для api — `vercel dev`),
   посилання на docs/.

## Критерії приймання

- [ ] `npm install` + `npm run build` в корені проходять без помилок і warnings.
- [ ] `npm start` → localhost показує заглушку "WatchList".
- [ ] `npm run lint` проходить.
- [ ] Немає закомічених секретів; `.env.example` існує.
- [ ] Перший коміт зроблено.

## Заборонено

- Не додавати Angular Material, Dexie, будь-які фіча-залежності — це наступні кроки.
- Не деплоїти на Vercel (це зробить власник вручну пізніше).

## Результат виконання

Зроблено все за списком завдань. Структура: `web/` (Angular), `api/` (Vercel
functions), `docs/`, кореневий `package.json`-оркестратор через npm workspaces.

**Відхилення від плану (задокументовані, мінімальні розумні рішення):**

1. **Версія Angular: 21.2.19, не 22.x.** На машині встановлено Node v20.19.5.
   `@angular/cli@22.0.6` (найновіша на момент виконання) вимагає
   `node ^22.22.3 || ^24.15.0 || >=26.0.0` — несумісно. `@angular/cli@21.2.19`
   вимагає `node ^20.19.0 || ...` — підходить. Обрано найновішу версію, сумісну
   з поточним Node. Якщо власник оновить Node до 22.22+/24.15+/26, можна
   зробити `ng update` до 22.x окремим кроком.
2. **Zoneless підтверджено як увімкнений**, хоча CLI (v21) більше не генерує
   явний виклик `provideZonelessChangeDetection()` і не додає `zone.js` у
   залежності при `--zoneless` — zoneless тепер налаштовується неявно
   (відсутність `zone.js` у `package.json`/полліфілах = zoneless). Перевірено:
   `zone.js` відсутній у дереві залежностей `web/`.
3. **npm workspaces замість двох незалежних lock-файлів.** Крок не деталізує
   механізм зв'язку кореневого `package.json` з `web/`. Щоб `npm install` в
   корені гарантовано ставив залежності і `web/`, і `api/`-тулінгу (як цього
   вимагає критерій приймання), корінь оголошує `"workspaces": ["web"]`.
   `api/` без власного `package.json` — використовує кореневий `node_modules`
   (типовий патерн для Vercel-монорепо з serverless-функціями).
4. **`npm run lint` в корені лінтить тільки `web/`** (буквально як написано в
   кроці: "lint, test → відповідні команди web/"). Для `api/` додано окремі
   `npm run lint:api` та `npm run typecheck:api` (не викликаються з `build`/`lint`
   автоматично, оскільки це не було в переліку скриптів-оркестраторів).
5. **`test-runner`: Vitest** (дефолт CLI v21, а не Karma) — відповідає
   ARCHITECTURE.md §9 ("Vitest/Karma — що дасть Angular CLI за замовчуванням").
6. **`@vercel/node@5.8.23`** встановлено як dev-залежність кореня. `npm audit`
   показує 10 вразливостей (helper-пакети `@vercel/build-utils` /
   `@vercel/python-analysis`, транзитивні, dev-only, використовуються лише
   локальним тулінгом для типів — не потрапляють у рантайм функції, яку білдить
   і деплоїть сам Vercel). Понижати `@vercel/node` до v4 заради фіксу не став —
   це ламаючий даунгрейд заради dev-залежностей, які не впливають на прод.
7. **`vercel.json` `outputDirectory`: `web/dist/web/browser`** — Angular CLI v21
   білдить у `dist/<project>/browser/` навіть без SSR (перевірено реальним
   білдом). Rewrite `/(.*) → /index.html` — без явного винятку для `/api/*`,
   бо Vercel застосовує rewrites лише після перевірки filesystem-роутів
   (включно з serverless-функціями), тобто `/api/*` не перехоплюється.

**Відомі проблеми:** немає. `npm install`, `npm run build`, `npm run lint`,
`npm test`, `npm run lint:api`, `npm run typecheck:api` — усі проходять без
помилок і попереджень. Перевірено вручну в браузері: `npm start` →
`http://localhost:4200` показує "WatchList" (і в `<title>`, і в тексті сторінки).
