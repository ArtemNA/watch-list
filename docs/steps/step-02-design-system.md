# Step 02 — Дизайн-система та i18n

**Передумови:** Step 01. Прочитай `docs/ARCHITECTURE.md` §7–8.

## Мета

Токени на CSS-змінних, dark/light теми, перетемізований Material (тільки
функціональні компоненти), базові власні UI-компоненти, i18n-сервіс uk/en
з перемикачем. Після кроку — апка з шапкою, перемикачами теми і мови.

## Завдання

1. `web/src/design/tokens.scss` — CSS custom properties на `:root`:
   - кольори: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`,
     `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-contrast`,
     `--color-accent`, `--color-danger`, `--color-success`;
   - статуси айтемів: `--color-status-want/watching/watched/dropped`;
   - `--radius-s/m/l`, `--space-1..6` (4/8/12/16/24/32px), `--shadow-1/2`,
     `--font-family`, `--font-size-s/m/l/xl`, `--transition-fast`.
   - Дефолтна тема — **dark** (кінотека!); `[data-theme='light']` перевизначає кольори.
2. `ThemeService` (core): signal `theme`, ставить `data-theme` на `<html>`,
   зберігає вибір у localStorage, initial — `prefers-color-scheme`.
3. Підключити Angular Material (остання версія) БЕЗ prebuilt-теми. Створити
   `web/src/design/material-overrides.scss`: M3-тему з наших токенів
   (через `mat.theme`/system variables або прямі перевизначення `--mat-*` змінних —
   обери робочий для поточної версії Material спосіб і задокументуй).
   Дозволені модулі: MatDialog, MatAutocomplete, MatMenu, MatSnackBar, MatTooltip.
4. Власні базові компоненти в `shared/ui/` (standalone, стилі тільки на токенах):
   - `app-button` (variants: primary / ghost / danger; sizes m/s),
   - `app-input` (+ textarea variant, label, error slot),
   - `app-card`,
   - `app-chip` (для статусів і жанрів, з кольором статусу),
   - `app-rating` (10 зірок, readonly + editable режими),
   - `app-empty-state` (іконка + текст + слот під кнопку).
5. i18n за ARCHITECTURE.md §7: `I18nService` (signal `lang`, метод `t()`),
   пайп `t`, словники `uk.json`/`en.json`. Всі рядки шапки/заглушок — через словники.
   Unit-тести: перемикання мови, відсутній ключ → повертається сам ключ + console.warn.
6. `ShellComponent`: шапка (лого-текст "WatchList", праворуч перемикач теми
   (іконка) і мови (uk/en)), `<router-outlet>`. Мобільна верстка обов'язкова
   (шапка не ламається на 360px).
7. Демо-сторінка `/dev/ui` (тільки для розробки): всі shared-компоненти
   в обох темах — щоб рев'юер бачив систему одним поглядом.

## Критерії приймання

- [ ] Перемикач теми міняє ВСЕ (включно з Material-діалогом — перевір на тестовому діалозі на /dev/ui).
- [ ] Перемикач мови миттєво міняє тексти без перезавантаження; вибір переживає reload.
- [ ] Жодного хардкод-кольору в компонентах — тільки var(--...).
- [ ] `npm run build`, `lint`, unit-тести i18n проходять.

## Заборонено

- Ніяких фіч бібліотеки/пошуку. Тільки дизайн-система, тема, i18n, шапка.

## Результат виконання

_(заповнює виконавець)_
