# Step 02 — Дизайн-система та i18n

**Передумови:** Step 01. Прочитай `docs/ARCHITECTURE.md` §7–8.

## Мета

Токени на CSS-змінних, dark/light теми, перетемізований Material (тільки
функціональні компоненти), базові власні UI-компоненти, i18n-сервіс uk/en
з перемикачем. Після кроку — апка з шапкою, перемикачами теми і мови.

## Напрям дизайну (ОБОВ'ЯЗКОВО, вимога власника)

Тема — **м'яка і темна**. Прочитай ARCHITECTURE.md §8 «Напрям дизайну» повністю.
Коротко: dark за замовчуванням; ніякого `#000`/`#fff` — графітовий фон з підтоном,
off-white текст; десатуровані акценти без неону; м'які радіуси й розлиті тіні;
розділення поверхнями, а не жорсткими бордерами. Light-тема — другорядна і теж
м'яка (тонований, не сліпучо-білий фон). Якщо десь вагаєшся між «різкіше» і
«м'якше» — обирай м'якше.

## Завдання

1. `web/src/app/design/tokens.scss` — CSS custom properties на `:root`:
   - кольори: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`,
     `--color-text`, `--color-text-muted`, `--color-primary`, `--color-primary-contrast`,
     `--color-accent`, `--color-danger`, `--color-success`;
   - статуси айтемів: `--color-status-want/watching/watched/dropped`;
   - `--radius-s/m/l`, `--space-1..6` (4/8/12/16/24/32px), `--shadow-1/2`,
     `--font-family`, `--font-size-s/m/l/xl`, `--transition-fast`.
   - Дефолтна тема — **dark** (кінотека!); `[data-theme='light']` перевизначає кольори.
   - Значення токенів — за «Напрямом дизайну» вище (м'які, приглушені).
2. `ThemeService` (core): signal `theme`, ставить `data-theme` на `<html>`,
   зберігає вибір у localStorage, initial — `prefers-color-scheme`.
3. Підключити Angular Material (остання версія) БЕЗ prebuilt-теми. Створити
   `web/src/app/design/material-overrides.scss`: M3-тему з наших токенів
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

- [x] Перемикач теми міняє ВСЕ (включно з Material-діалогом — перевір на тестовому діалозі на /dev/ui).
- [x] Перемикач мови миттєво міняє тексти без перезавантаження; вибір переживає reload.
- [x] Жодного хардкод-кольору в компонентах — тільки var(--...).
- [x] У токенах немає `#000`/`#fff` (і взагалі чистих чорного/білого); дефолт — темна тема.
- [x] `npm run build`, `lint`, unit-тести i18n проходять.

## Заборонено

- Ніяких фіч бібліотеки/пошуку. Тільки дизайн-система, тема, i18n, шапка.

## Результат виконання

> **Ревью архітектора (2026-07-11): ПРИЙНЯТО.** Перевірено: build/lint/тести
> (13/13) + вручну в браузері (обидві теми, перемикання мови на льоту,
> MatDialog у темі токенів, мобільна ширина 375px). Grep підтвердив: жодного
> хардкод-кольору поза tokens.scss. Відхилення 1–8 обґрунтовані; рішення про
> `pure: false` для TPipe ПІДТВЕРДЖЕНО і зафіксовано (DECISIONS #13,
> ARCHITECTURE §7 виправлено). Списки Material-модулів зведено до одного
> (ARCHITECTURE §8). `/dev/ui` оголошено постійною сторінкою (DECISIONS #14).

Зроблено все за списком завдань:

1. `web/src/app/design/tokens.scss` — усі токени з завдання 1, дефолт dark на `:root`,
   `[data-theme='light']` перевизначає. Кольори підібрані й перевірені вручну за
   формулою WCAG relative luminance (не лише "на око"): основний текст на фоні
   ~13:1 в обох темах, muted-текст ~6.7:1 (dark) / ~4.7:1 (light, AA), контраст
   тексту на primary-кнопці ~7–7.6:1 в обох темах.
2. `ThemeService` (`core/theme/theme.service.ts`) — signal `theme`, читає
   localStorage → `prefers-color-scheme` → dark. Свідомо БЕЗ `effect()`: сайд-ефект
   (атрибут + localStorage) виконується прямо в `setTheme`/конструкторі, а не в
   реактивному `effect()` — простіше, синхронно тестується, без залежності від
   таймінгу флашу ефектів у zoneless-режимі.
3. Angular Material 21.2.14 + CDK 21.2.14 + Animations 21.2.18 (версії, що
   збігаються з встановленим `@angular/core@21.2.18` — peer deps точні, не
   діапазон). `web/src/app/design/material-overrides.scss` — `mat.theme()`
   (палітра-заглушка violet, яка ніде не проявляється) + `mat.theme-overrides()`,
   що перезаписує системні `--mat-sys-*` токени значеннями `var(--color-*)`.
   Обраний спосіб (а не окремі `*-theme()` мікс-іни на компонент) задокументований
   у самому файлі. `provideAnimationsAsync()` додано в `app.config.ts`.
4. `shared/ui/`: `app-button`, `app-input`, `app-card`, `app-chip`, `app-rating`,
   `app-empty-state` — усі standalone, тільки `input()`/`model()` сигнали, стилі
   лише на токенах, є `shared/ui/index.ts` барель.
5. `core/i18n/`: `I18nService` (signal `lang`, `t(key, params?)`, дефолт `uk`),
   `TPipe` (`| t`), `uk.json`/`en.json`. Тести: дефолт, перемикання, persist,
   missing key → сам ключ + `console.warn`.
6. `Shell` (`shell/`) — шапка з лого "WatchList", перемикачами мови (UK/EN) і
   теми (inline SVG sun/moon, без Material Symbols — не тягнемо зовнішній
   font/іконки, local-first). Перевірено на 360px — не ламається.
7. `/dev/ui` (`features/dev-ui/`) — демонструє всі shared-компоненти +
   `TestDialog` через `MatDialog` (критерій приймання: тема Material = тема токенів).

**Відхилення від плану (задокументовані):**

1. **`TPipe` зроблено `pure: false`, хоча ARCHITECTURE.md §7 каже "impure не
   потрібен — сигнал тригерить CD".** Емпірично перевірено в браузері: це
   невірно. Angular pure-пайп кешує результат за значенням аргументу `key`;
   коли міняється лише сигнал `lang()` всередині `transform()`, view
   перерендерюється (кнопка активної мови оновлюється — вона читає сигнал
   напряму в шаблоні), але сам виклик `transform()` пропускається, бо `key` не
   змінився → текст лишається старою мовою. Побачено вручну: клік на "EN" одразу
   підсвічував кнопку, але текст лишався українською, доки не перезавантажити
   сторінку (тоді читається новий `lang` з localStorage при першому рендері).
   Виправлено на `pure: false` — тепер `transform()` викликається при кожному CD
   і мова міняється миттєво (перевірено повторно в браузері). Рекомендація
   архітектору: поправити фразу в ARCHITECTURE.md §7.
2. **Material встановлено вручну (`npm install`), а не через `ng add @angular/material`.**
   Схематика `ng add` в цій версії завжди генерує кастомну тему (опції "custom"
   вже нема) І додає в `index.html` `<link>` на Google Fonts (Roboto +
   Material Symbols) — зовнішня мережева залежність, що суперечить
   local-first і вимагає онлайн для першого рендеру шрифтів. Замість цього:
   ручний `npm install @angular/material @angular/cdk @angular/animations`,
   свій `material-overrides.scss`, типографіка Material вказує на наш
   `--font-family` (системний font-stack, без Google Fonts).
3. **`inverse-surface`/`inverse-on-surface`** (їх типово споживають
   MatSnackBar/MatTooltip для контрастної "спливаючої" бульбашки) навмисно
   прирівняні до звичайних `surface`/`on-surface` — щоб не з'являлась різка
   інвертована пляма кольору, що суперечило б "м'якому" напряму дизайну
   (ARCHITECTURE §8). Задокументовано в самому `material-overrides.scss`.
4. **Розбіжність переліку дозволених Material-модулів.** ARCHITECTURE.md §8
   називає `MatSlideToggle`, а сам step-02 (завдання 3) — `MatTooltip` (немає
   `MatSlideToggle`). Виконано буквально за списком з цього step-файлу
   (MatDialog, MatAutocomplete, MatMenu, MatSnackBar, MatTooltip), оскільки
   правило "працюй строго по своєму step-файлу" пріоритетніше. Архітектору
   варто звести обидва списки до одного.
5. **Тач-таргети менше 40px у двох свідомих випадках** (загальне правило —
   ARCHITECTURE §8 / CLAUDE.md): `app-button[size='s']` — 36px (компактний
   варіант для щільних рядків, не основний CTA); зірки `app-rating` — 28px
   кожна (10 суміжних кнопок в ряд не влізають по 40px навіть на 360px:
   10×40+9×4=436px). Обидва випадки закоментовані прямо в `.scss`-файлах.
6. **Маршрут `''` тимчасово редіректить на `/dev/ui`** (`app.routes.ts`),
   бо реальної сторінки бібліотеки ще нема (Step 03–04). Буде замінено, коли
   з'явиться справжній `LibraryComponent`.
7. **`resolveJsonModule: true`** додано в `web/tsconfig.json` — потрібно для
   прямого `import uk from './uk.json'` типізованих словників.
8. **Чистий перевстановлення `node_modules`** (`rm -rf node_modules web/node_modules
   package-lock.json && npm install`) після встановлення Material/CDK/Animations:
   інкрементальні `npm install X --workspace=web` в кілька заходів залишили
   `@angular/compiler` тільки в `web/node_modules` без хоїста в корінь, через що
   Vitest (`@angular/core/testing`) не міг його резолвнути ("Cannot find package
   '@angular/compiler'"). Чиста переустановка вирішила проблему; `package-lock.json`
   перегенеровано (ті самі версії, інший порядок дерева).

**Відомі проблеми:** немає. `npm run build`, `npm run lint`, `npm test` (13/13),
`npm run lint:api`, `npm run typecheck:api` — усі проходять. Вручну перевірено в
браузері (Chromium, через `ng serve --port 4201`): перемикач теми міняє все
включно з MatDialog; перемикач мови міняє текст миттєво (після виправлення #1)
і переживає reload; розкладка коректна на 360px (шапка, кнопки, чипи, 10 зірок
рейтингу, діалог). `npm audit` показує ті самі 10 pre-existing вразливостей у
`@vercel/*` dev-залежностях, що й після Step 01 (не пов'язані з цим кроком).
