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

_(заповнює виконавець)_
