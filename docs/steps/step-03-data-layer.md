# Step 03 — Шар даних (моделі + IndexedDB)

**Передумови:** Steps 01–02. Прочитай `docs/ARCHITECTURE.md` §2–3.

## Мета

Повний локальний шар даних: типи, Dexie-база, репозиторій із сигналами.
UI поки мінімальний — тимчасова сторінка для ручного додавання айтема, щоб
перевірити CRUD (нормальний UI — Step 04).

## Завдання

1. `core/models/media-item.model.ts` — інтерфейси `MediaItem`, `CustomLink`,
   типи `MediaKind`, `MediaStatus`, `ExternalRatings` ТОЧНО за ARCHITECTURE.md §2.
2. `core/db/app-db.ts` — Dexie v4, схема за §3 (items + meta), синглтон через DI.
3. `core/data/items.repository.ts`:
   - `items` — signal усіх НЕвидалених айтемів (liveQuery → signal),
   - `getById(id)`, `add(partial)` (сам генерує id/createdAt/updatedAt через `crypto.randomUUID()`),
   - `update(id, patch)` — ставить `updatedAt = now`, НЕ дозволяє міняти id/createdAt,
   - `softDelete(id)` — ставить deletedAt + updatedAt,
   - `restore(id)`,
   - `changedSince(iso)` — включно з tombstones (знадобиться для синку),
   - `counts` — signal лічильників по статусах.
   Всі мутації updatedAt — ТІЛЬКИ всередині репозиторію.
4. `core/data/meta.repository.ts` — get/set по ключу (`lastSyncAt`, тощо).
5. Тимчасова сторінка `/dev/data`: форма (назва, тип, статус) → add; список
   з кнопками update-status / delete / restore. Мінімум стилів, це dev-сторінка.
6. Unit-тести репозиторію (fake-indexeddb): add ставить поля; update оновлює
   updatedAt і відхиляє зміну id; softDelete ховає зі списку, але видно в changedSince;
   changedSince фільтрує коректно.

## Критерії приймання

- [ ] Айтеми переживають reload сторінки (реально в IndexedDB).
- [ ] Список на /dev/data реактивний: додав — з'явився без reload.
- [ ] Тести репозиторію зелені; build/lint чисті.

## Заборонено

- Ніяких зовнішніх API. Ніякого справжнього UI бібліотеки (Step 04).

## Результат виконання

> **Ревью архітектора (2026-07-11): ПРИЙНЯТО.** Перевірено: build/lint/тести
> (17/17) + вручну в браузері (реактивне додавання без reload, лічильники,
> персистентність після перезавантаження). Код-ревью: модель точно за §2,
> схема Dexie за §3, add/update захищені від підміни id/createdAt/updatedAt
> навіть в обхід типів (покрито тестом), changedSince включає tombstones.
> Відхилення по dev-сторінці прийнятне (тимчасова сторінка, зникне в Step 04).

Виконано повністю за планом.

### Що зроблено

- `core/models/media-item.model.ts` — `MediaItem`, `CustomLink`, `ExternalRatings`,
  `MediaKind`, `MediaStatus` точно за ARCHITECTURE.md §2.
- `core/db/app-db.ts` — `AppDb extends Dexie`, `@Injectable({ providedIn: 'root' })`,
  версія 1, схема `items`/`meta` точно за §3.
- `core/data/items.repository.ts` — `ItemsRepository`:
  - `items` — сигнал НЕвидалених айтемів через `toSignal(from(liveQuery(...)))`
    (стандартний патерн інтеграції Dexie liveQuery з Angular signals: Dexie's
    `Observable` сумісний з rxjs через `Symbol.observable`, тому `from(liveQuery(...))`
    працює напряму);
  - `counts` — `computed` з `items` (лічильники по `MediaStatus`);
  - `getById`, `add` (генерує `id`/`createdAt`/`updatedAt`, дефолт `links: []`),
    `update` (завжди ставить нове `updatedAt`; **раннтайм-захист**: `id`/`createdAt`/
    `updatedAt` видаляються з патча ДО запису, навіть якщо викликач обійшов типи
    через `as`/`any` — покрито тестом), `softDelete`, `restore` (`deletedAt: null`),
    `changedSince(iso)` (`where('updatedAt').above(iso)`, включно з tombstones).
- `core/data/meta.repository.ts` — `get<T>(key)`/`set(key, value)`.
- Залежності: додано `dexie@^4.4.4` (dependencies) і `fake-indexeddb@^6.2.5`
  (devDependencies) у `web/package.json`.
- `features/dev-data/` — тимчасова сторінка `/dev/data` (маршрут доданий у
  `app.routes.ts` поряд з `/dev/ui`): форма додавання (назва/тип/статус),
  список бібліотеки з кнопками зміни статусу (по одній на кожен `MediaStatus`)
  і видалення, лічильники по статусах, і секція «Смітник» для видалених
  айтемів з кнопкою «Відновити». Стилі — тільки токени, i18n-ключі `devData.*`
  додані в `en.json`/`uk.json` обома мовами.
- Тести `items.repository.spec.ts` (fake-indexeddb, `TestBed`): add ставить
  поля/дефолти; update оновлює `updatedAt` і відхиляє зміну `id`/`createdAt`
  (навіть при обході типів); softDelete ховає зі списку й лишає видимим у
  `changedSince`, restore повертає в список; changedSince коректно фільтрує
  за межею часу. Усі 4 тести зелені (разом з існуючими — 17/17).

### Відхилення від плану

- Публічний сигнал `items` навмисно не показує видалені айтеми (за
  специфікацією репозиторію), тому для кнопки «Відновити» на dev-сторінці
  список видалених тягнеться через `changedSince('1970-01-01T00:00:00.000Z')`
  і оновлюється вручну (після add/delete/restore), а не реактивно через
  сигнал. Це прийнятно для тимчасової dev-сторінки (нормальний UI видалення/
  відновлення — не в скоупі Step 03); основний список бібліотеки лишається
  повністю реактивним (`toSignal`), що й було критерієм приймання.
- `.claude/launch.json` (конфіг dev-сервера для Browser-пейну, порт 4201) вже
  існував із попереднього кроку — не змінювався.

### Відомі проблеми

Немає. `npm run build`, `npm run lint`, `npm test` — чисті (build без
попереджень, lint 0 помилок, тести 17/17). Вручну перевірено в браузері:
додавання без reload, зміна статусу, delete→trash→restore, айтем переживає
справжній `window.location.reload()`, адаптивність на 360px, обидві теми,
обидві мови — все коректно.
