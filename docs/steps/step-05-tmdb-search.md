# Step 05 — Пошук TMDB

**Передумови:** Steps 01–04. Прочитай `docs/ARCHITECTURE.md` §4–5.
**Потрібно від власника:** TMDB_API_KEY у `.env.local` (корінь) і пізніше у Vercel env.

## Мета

Живий пошук фільмів/серіалів через TMDB (проксі на бекенді), мовами en/uk/ru,
додавання знайденого в бібліотеку з повними метаданими.

## Завдання

### Бекенд

1. `api/_lib/tmdb.ts` — fetch-обгортка до `https://api.themoviedb.org/3`
   з `TMDB_API_KEY` (v4 Bearer або v3 api_key — за форматом ключа).
2. `api/tmdb/[...path].ts` — GET-proxy: приймає path + query, **whitelist**
   дозволених префіксів: `search/multi`, `search/movie`, `search/tv`,
   `movie/`, `tv/`. Інше → 404. Прокидає query-параметри (language, query, page,
   append_to_response), повертає JSON як є. Кеш-заголовок
   `Cache-Control: s-maxage=86400` для movie/tv деталей, `s-maxage=300` для search.
3. Локальний dev: задокументуй у README запуск через `vercel dev` АБО додай
   крихітний dev-сервер (`api-dev.mjs`, node:http + ті самі handler-функції),
   якщо vercel dev незручний — обери одне, задокументуй.

### Фронтенд

4. `core/api/tmdb-api.service.ts`: `searchMulti(query, lang)`, `getDetails(kind, id)`
   (з `append_to_response=external_ids,translations`), типи відповідей (мінімально потрібні поля).
5. Логіка пошуку (`features/search/search.service.ts` + unit-тести):
   - запит з `language` = поточна мова UI (uk → `uk-UA`, en → `en-US`);
     кирилична розкладка запиту НЕ міняє language — TMDB шукає по всіх
     перекладах назв, тож рос/укр запити працюють у будь-якому режимі;
   - якщо 0 результатів → повторний запит з `language=en-US` (fallback);
   - відфільтрувати `media_type` не movie/tv; дедуплікація за `(media_type, id)`;
   - сортування: як віддав TMDB (він ранжить за релевантністю/популярністю);
   - позначити результати, які ВЖЕ є в бібліотеці (по tmdbId) — чіп «У бібліотеці».
6. UI `features/search/search-page` (роут `/search`, кнопка в шапці + з бібліотеки):
   - інпут з debounce 400мс, min 2 символи, спінер, обробка помилок
     (снекбар + стан «повторити»),
   - картки результатів: постер, назва мовою UI + оригінальна, рік, тип, рейтинг TMDB,
   - кнопка «+» на картці: тягне `getDetails`, мапить у `MediaItem`
     (tmdbId, imdbId з external_ids, title за мовою UI, titleUk з translations,
     originalTitle, year, posterUrl w342, overview, genres, runtime,
     externalRatings.tmdb, metadataUpdatedAt) → `repo.add` зі статусом want →
     снекбар з лінком на айтем; повторне додавання того ж tmdbId — заборонене
     (показати «вже в бібліотеці» + лінк).
7. Пагінація: кнопка «Показати ще» (page+1), не infinite scroll.
8. i18n-рядки uk/en, мобільна верстка.

## Критерії приймання

- [x] Пошук "Дюна", "Dune", "Дюна 2" знаходить ті самі фільми; додавання
      з будь-якого запиту дає ОДИН айтем з коректними назвами uk+original.
- [x] Ключ TMDB відсутній у фронтенд-бандлі (перевірити пошуком по dist).
- [x] Помилка мережі не ламає сторінку (стан retry).
- [x] Тести search.service (fallback, dedup, мапінг у MediaItem) зелені; build/lint чисті.

## Заборонено

- Не чіпати OMDb / watch providers (Step 06). Не робити auth (Step 07).

## Результат виконання

**Бекенд:**

- `api/_lib/tmdb.ts` — `tmdbFetch(path, params)`: будує URL до `api.themoviedb.org/3`,
  визначає формат ключа евристично (v4 JWT-токен починається з `eyJ` → `Authorization: Bearer`,
  інакше — v3 32-символьний hex → query-параметр `api_key`). Наявний ключ у `.env.local`
  виявився v3-форматом — перевірено скриптом (без виводу самого ключа в лог).
- `api/tmdb/[...path].ts` — GET-proxy з whitelist (`search/multi`, `search/movie`, `search/tv`,
  `movie/*`, `tv/*`), проброс `language/query/page/append_to_response/include_adult`,
  `Cache-Control: s-maxage=300` для search, `s-maxage=86400` для деталей. 404 для чужих шляхів.
- Локальний dev: обрано **`api-dev.mjs`** (node:http + тонкий адаптер req/res →
  VercelRequest/VercelResponse, викликає ті самі handler-функції), а не `vercel dev` —
  бо Vercel CLI не встановлено і не потрібен окремий акаунт для локальної розробки.
  Запускається через `tsx` (доданий у root devDependencies), бо сам Node 20 не виконує
  `.ts`-файли напряму. Скрипт `npm run dev:api`, порт 3000 (як і очікує `proxy.conf.json`).
  Задокументовано в README.

**Фронтенд:**

- `core/api/tmdb-api.service.ts` — `TmdbApiService` (HttpClient): `searchMulti`, `getDetails`
  з мінімальними DTO-типами (`TmdbSearchItem`, `TmdbDetails`, translations/external_ids).
  Додано `provideHttpClient()` в `app.config.ts` (перше використання HttpClient у проєкті).
- `features/search/search-mapping.ts` — **чисті** функції без Angular/Dexie-залежностей
  (тільки `import type`): `languageForUi`, `dedupeSearchItems`, `mergeSearchItems`,
  `mapSearchItem`, `mapDetailsToNewItem`. Винесені в окремий файл (а не в сам сервіс) —
  так само, як `library-filters.ts`/`link-utils.ts` в попередніх кроках.
- `features/search/search.service.ts` — `SearchService` (Injectable): `fetchResults`
  (мова = поточна UI, fallback на en-US при 0 результатах), `libraryTmdbIds` (computed
  Map tmdbId→id для позначки «У бібліотеці» без повторного фетчу), `toResultView`,
  `addToLibrary` (idempotent — якщо tmdbId вже в бібліотеці, повертає існуючий айтем
  замість дублювання).
- `features/search/search-page/` — UI на `/search`: debounce 400мс, мін. 2 символи,
  спінер, стан помилки зі снекбаром+retry, «Показати ще» (page+1, не infinite scroll),
  картки (постер/назва/оригінал/рік/тип/рейтинг), чіп «У бібліотеці» (лінк на айтем) або
  кнопка «Додати». `results` — `computed` з сирих TMDB-результатів + реактивної
  `libraryTmdbIds`, тому позначка «У бібліотеці» оновлюється миттєво після додавання
  без повторного пошуку.
- Роут `/search` (`app.routes.ts`), посилання в шапці (`shell.html`, поруч з логотипом)
  і кнопка на сторінці бібліотеки (`library-page.html`, поруч з «Додати вручну»).
- i18n: усі нові рядки в `uk.json`/`en.json` (`nav.search`, `search.*`, `library.searchTmdb`).

**Тести:** `search-mapping.spec.ts` — 13 тестів (мова, дедуп на пошуку, дедуп на
пагінації, мапінг search-результату movie/tv, мапінг деталей у `NewMediaItemInput`
включно з titleUk/imdbId/runtime/genres, edge-кейси відсутніх полів). Разом з
попередніми — 44/44 зелені стабільно (3 прогони поспіль).

**Відхилення від плану:**

- Чисті функції винесені в окремий файл `search-mapping.ts`, а не залишені в
  `search.service.ts` поруч з Injectable-класом. Причина: коли pure-функції жили в
  одному файлі з `SearchService` (який імпортує `ItemsRepository` як значення, не тип),
  імпорт файлу в spec-тесті транзитивно тягнув `AppDb`/Dexie, і це **виявило існуючу
  race condition** в `items.repository.spec.ts` (`fake-indexeddb` + паралельні spec-файли
  vitest) — тест почав падати нестабільно рівно тому, що додався 8-й spec-файл і змінився
  розподіл файлів по воркерах. Перевірено через `git stash -u`: на чистому master (7
  spec-файлів) `items.repository.spec.ts` завжди зелений; з 8 файлами — падає. Це
  попередня крихкість тестової інфраструктури (Step 03), не бага в логіці пошуку. Винесення
  чистих функцій в окремий файл (тільки `import type` для доменних типів) прибирає
  транзитивний імпорт Dexie з тестів пошуку — після цього 44/44 тестів стабільно зелені
  в 3+ прогонах. Побічний ефект — архітектура стала консистентнішою з існуючим паттерном
  (`library-filters.ts`, `link-utils.ts`).
- Знайдено і виправлено бенг під час ручної перевірки в браузері: `hasSearched` спершу
  був `computed(() => this.lastQuery !== '')`, де `lastQuery` — звичайне поле класу, а не
  сигнал. `computed` в Angular реактивний лише на читання сигналів усередині — читання
  plain-поля не створює залежність, тому обчислення застигало на першому (порожньому)
  значенні назавжди, і UI ніколи не показував результати/порожній стан, лишаючись на
  підказці «Введіть щонайменше 2 символи», хоча HTTP-запит реально виконувався і
  повертав 200. Виправлено: `lastQuery` тепер `signal('')`. Виявлено й підтверджено
  через ручний прогін у браузері (без нього тест-сюіт цього б не спіймав, бо юніт-тести
  покривають лише чисті функції, не сам компонент) — важливий урок: computed() з plain-
  полем всередині мовчки не оновлюється, треба уважно стежити, що ВСЕ, від чого залежить
  computed, є сигналом.
- Для локального ручного тестування в Browser-пейні додано `--proxy-config proxy.conf.json`
  до конфігурації `web` у `.claude/launch.json` (раніше запускала `ng serve` без проксі,
  тому `/api/*` не працював при попередньому перегляді через Browser pane). Суто dev-tooling
  конфіг, не архітектурне рішення.
- `movie/`/`tv/` у whitelist трактовано як «шлях починається з префікса і має ще
  щось після» (тобто `movie/603692` дозволено, голий `movie/` — ні), бо тільки так
  використовується фронтендом (`getDetails`).

**Ручна перевірка (реальний TMDB API, `.env.local`):**

- `curl` до `api-dev.mjs`: "Дюна" (uk-UA), "Dune" (uk-UA) і "Дюна 2" (uk-UA) — усі
  знаходять `tmdbId 438631` (Дюна, 2021) серед перших результатів (крім «Дюна 2», яка
  коректно знаходить лише `693134` — «Дюна: Частина друга», що й очікується від
  іншого запиту); деталі фільму (`imdb_id`, жанри, uk-переклад назви) отримані коректно.
- У браузері (Chromium, Claude Browser pane), реальний TMDB через `api-dev.mjs`:
  - пошук "Dune" (EN) і "Дюна" (UK) — картки з постерами/оцінками/роками, локалізовані
    назви + оригінал, чіп типу (Movie/TV show, Фільм/Серіал);
  - додавання "Dune" (2021) в бібліотеку → перевірено на сторінці айтема: назва,
    рік, жанри (Science Fiction, Adventure, War), постер, overview — усе змінилося
    коректно; повторний пошук одразу показав чіп «У бібліотеці» (реактивно, без
    релоаду);
  - порожній запит (`zzzznonexistentqueryxyz`) → коректний empty-state (fallback
    на en-US теж дав 0);
  - зупинка `api-dev.mjs` під час пошуку → стан помилки зі снекбаром/кнопкою
    «Повторити»; після відновлення сервера «Повторити» коректно відновлює результати;
  - пагінація «Показати ще» (page 2) → нові картки додались без дублікатів;
  - мобільна верстка 360px (2 колонки, шапка не ламається) і темна тема — ок.
- `npm run build` (619.97kB initial, у межах бюджету 650kB warning), `npm run lint`,
  `npm run lint:api`, `npm run typecheck:api` — усі чисті.
- Пошуком по `web/dist/**` підтверджено відсутність TMDB-ключа в бандлі.
- Усі запущені для перевірки процеси (`api-dev.mjs`, `ng serve`) зупинені.

**Відомі проблеми:** немає нових. Existing pre-Step-05 flakiness у
`items.repository.spec.ts` описана вище в «Відхилення» — усунена побічно рефакторингом,
а не проігнорована.
