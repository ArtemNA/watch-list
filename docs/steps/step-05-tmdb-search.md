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

- [ ] Пошук "Дюна", "Dune", "Дюна 2" знаходить ті самі фільми; додавання
      з будь-якого запиту дає ОДИН айтем з коректними назвами uk+original.
- [ ] Ключ TMDB відсутній у фронтенд-бандлі (перевірити пошуком по dist).
- [ ] Помилка мережі не ламає сторінку (стан retry).
- [ ] Тести search.service (fallback, dedup, мапінг у MediaItem) зелені; build/lint чисті.

## Заборонено

- Не чіпати OMDb / watch providers (Step 06). Не робити auth (Step 07).

## Результат виконання

_(заповнює виконавець)_
