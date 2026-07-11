# Step 07 — Бекенд: MongoDB + аутентифікація

**Передумови:** Steps 01–06 (мінімально — 01; але порядок у PLAN.md суворий).
Прочитай `docs/ARCHITECTURE.md` §2 (User), §5.
**Потрібно від власника:** MongoDB Atlas M0 кластер, `MONGODB_URI` та `JWT_SECRET`
у `.env.local` / Vercel env.

## Мета

Робочі register/login з JWT + фронтенд-сторінка входу. Синк даних — НЕ тут (Step 08).

## Завдання

### Бекенд

1. `api/_lib/db.ts` — MongoClient з кешем з'єднання в `globalThis` (serverless-паттерн),
   `getDb()`. При першому виклику — ensure indexes: `users.email` unique,
   `items (userId, id)` unique.
2. `api/_lib/auth.ts`: bcryptjs (cost 10), `signJwt(userId)` (HS256, TTL 30 днів,
   бібліотека `jose`), `requireAuth(req)` → `userId` або кидає 401-відповідь.
3. `api/_lib/http.ts` — хелпери: json-відповідь, обробка помилок (try/catch wrapper,
   500 без стектрейсу назовні), перевірка методу.
4. `POST /api/auth/register`: валідація (email regex, пароль ≥ 8 символів),
   email → lowercase/trim; дублікат email → 409 з кодом `EMAIL_TAKEN`;
   успіх → `{ token, email }`.
5. `POST /api/auth/login`: перевірка пароля; невірні креденшили → 401
   `INVALID_CREDENTIALS` (однакова відповідь для «нема юзера» і «не той пароль»).
6. Найпростіший rate limit на auth-ендпоінти (in-memory Map по IP, 10 спроб/хв) —
   з коментарем, що на serverless це best-effort.

### Фронтенд

7. `core/auth/auth.service.ts`: signals `isLoggedIn`, `email`; `register()`,
   `login()`, `logout()`; токен у localStorage; функціональний HTTP-інтерцептор
   додає `Authorization: Bearer` до запитів на `/api/sync/*`; відповідь 401 → logout + снекбар.
8. `features/auth/auth-page` (роут `/auth`): один компонент, таби «Увійти /
   Зареєструватись», поля email+пароль (+повтор пароля для реєстрації),
   людські повідомлення про помилки (i18n): «Цей email вже зареєстровано»,
   «Невірний email або пароль», «Пароль закороткий».
9. Шапка: якщо не залогінений — кнопка «Увійти» (з підказкою-тултіпом
   «Потрібно лише для синхронізації між пристроями»); якщо залогінений —
   меню з email, пунктами «Синхронізація» (заглушка до Step 08) і «Вийти».
   Logout НЕ чіпає локальні дані.
10. Unit-тести: auth.service (токен зберігається/чиститься), бекенд-валідатори
    (email/password), якщо тестова інфраструктура для api відсутня — додай vitest для `api/`.

## Критерії приймання

- [ ] Реєстрація → logout → login тим самим паролем працює (руками через UI, з `vercel dev`).
- [ ] Повторна реєстрація того ж email → зрозуміла помилка в UI обома мовами.
- [ ] У Mongo лежить hash, не пароль. JWT перевіряється: підроблений токен → 401.
- [ ] Без логіну вся апка працює як раніше (нічого не заблоковано).

## Заборонено

- Ніякого синку айтемів (Step 08). Ніяких refresh-токенів, відновлення пароля, OAuth.

## Результат виконання

> **Ревью архітектора (2026-07-11): ПРИЙНЯТО.** Перевірено: build/lint/
> typecheck + 70 web- і 9 api-тестів; живий e2e з реальним Atlas: register
> (201) → повторний register (409 EMAIL_TAKEN) → login (200) → невірний
> пароль (401 INVALID_CREDENTIALS); у Mongo — bcrypt-хеш `$2b$10$...`, плейн-
> тексту немає, unique-індекс email на місці; реєстрація через UI — редірект
> у бібліотеку, email-меню в шапці, локальні дані незаймані. Тестові юзери
> прибрані з БД. Відзначаю сильні рішення виконавця: insert-then-catch-11000
> проти TOCTOU, dummy-hash проти timing-атаки на login, кешування
> ensure-indexes. Обидва відхилення (ім'я бази в коді, окремий vitest-конфіг
> для api/) прийняті.

Зроблено все з переліку завдань 1–10.

**Бекенд** (`api/_lib/db.ts`, `auth.ts`, `http.ts`, `rate-limit.ts`, `validators.ts`,
`api/auth/register.ts`, `api/auth/login.ts`):

- `getDb()` кешує `MongoClient` у `globalThis` (окремо — і проміс ensure-indexes,
  щоб не створювати індекси повторно на кожен виклик у теплому інстансі).
- `register`: замість find-then-insert перевірки на дублікат email — одразу
  `insertOne`, дублікат ловиться по коду помилки Mongo `11000` (unique-індекс).
  Без цього був би TOCTOU-race при двох паралельних реєстраціях того самого email.
- `login`: порівняння пароля виконується ЗАВЖДИ (навіть коли юзера нема — проти
  фіктивного bcrypt-хешу), щоб час відповіді не видавав існування акаунта.
- Rate limit (in-memory Map, 10/хв) перевірено вручну: 11-й і 12-й запити на
  `/api/auth/login` за хвилину повертають `429`.
- `requireAuth(req)` з `api/_lib/auth.ts` готовий для Step 08 (захищені
  `/api/sync/*`), сам по собі жодним ендпоінтом ще не викликається — Step 07
  явно забороняє синк айтемів. Перевірено окремо (не через HTTP-ендпоінт,
  бо такого ще нема): валідний JWT приймається, підроблений (зламаний підпис)
  і відсутній токен — відхиляються з 401.
- `api-dev.mjs` доповнено парсингом JSON-body та роутингом
  `/api/auth/register`/`/api/auth/login` (раніше сервер обробляв лише GET).

**Відхилення від плану:**

- **Ім'я бази Mongo.** `MONGODB_URI` з `.env.local` не містить шляху з назвою
  бази (Atlas видає connection string без неї) — `client.db()` без аргументу
  впав би з помилкою. Зафіксовано явне ім'я бази `watchlist` у `api/_lib/db.ts`.
  Не задокументовано в ARCHITECTURE.md, бо це деталь підключення, а не
  архітектурне рішення.
- **`vitest` для `api/` — окремий конфіг у корені** (`vitest.config.ts` +
  `npm run test:api`), бо `api/` не є npm-workspace і не підхоплюється Angular
  CLI-білдером `web`. Root `package.json` отримав секцію `dependencies`
  (`mongodb`, `bcryptjs`, `jose` — раніше там були лише `devDependencies`).

**Фронтенд** (`core/auth/auth.service.ts`, `auth.interceptor.ts`,
`features/auth/auth-page/`, оновлення `shell`):

- `AuthService`: сигнали `token`/`email`/`isLoggedIn`, `register`/`login`
  (спільний приватний `authenticate`), `logout` (чіпає лише
  `watchlist.auth.*` ключі localStorage — інші дані, зокрема IndexedDB,
  не займає). Помилки з бекенда мапляться в типізований `AuthError.code`.
- Функціональний інтерцептор додає `Authorization: Bearer` лише до запитів
  `/api/sync/*` (яких ще нема — готово для Step 08) і на 401 з такого запиту
  робить logout + снекбар.
- `AuthPage` (`/auth`): один компонент, таби Увійти/Зареєструватись (кнопки
  з `role="tab"`), клієнтська валідація email/довжини пароля/збігу паролів
  через `computed`-сигнали (за зразком `AddItemDialog`), серверні помилки
  (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `TOO_MANY_REQUESTS` тощо) — окремими
  i18n-повідомленнями обома мовами.
- `AppInput` (`shared/ui/`) отримав новий `input<InputType>('text' | 'email' | 'password')`
  — досі всі інпути рендерились як `type="text"`. Демо на `/dev/ui` оновлено
  (поле-пароль у секції «Поля вводу»), як того вимагає CLAUDE.md.
- Шапка: залогінений стан — кнопка з email (обрізається по ширині, `max-width`)
  і `MatMenu` («Синхронізація» — задизейблений стаб до Step 08, «Вийти»);
  незалогінений — посилання «Увійти» на `/auth` з `MatTooltip`-підказкою.
  Guard на `/auth` НЕ додавався (і не вимагався планом) — сторінка доступна
  і залогіненому юзеру.

**Знайдений і виправлений баг (ручне тестування в браузері):** форма
`AuthPage` мала `<input type="email">` без `novalidate` на `<form>`.
Браузерна нативна constraint-валідація email-формату блокувала спрацювання
`(submit)` ще ДО того, як Angular-обробник встигав виставити `submitted` —
кнопка «Увійти»/«Зареєструватись» з невалідним email просто нічого не
робила, без жодного повідомлення (ні нашого і18n, ні нативного — бо
`novalidate` не було, але assertion `checkValidity()` мовчки відхиляв
`requestSubmit`). Виправлено додаванням `novalidate` на `<form>` — уся
валідація тепер іде через наші `computed`-сигнали і показує локалізовані
повідомлення, як і заплановано. Без цього фікса critерій приймання
«Повторна реєстрація того ж email → зрозуміла помилка в UI» був би
неможливим для перевірки — форма з невалідним email взагалі не сабмітилась.

**Тести:** `api/_lib/validators.spec.ts` (9 тестів, чисті функції
email/password), `web/src/app/core/auth/auth.service.spec.ts` (7 тестів:
початковий стан, login/register зберігають токен, logout чистить лише свої
ключі, мапінг помилок 409/401/500 у `AuthError.code`) — через
`HttpClientTestingModule`. `shell.spec.ts` довелось доповнити
`provideHttpClient()`/`provideHttpClientTesting()`, бо `Shell` тепер injectить
`AuthService`. Разом: 70/70 web-тестів, 9/9 api-тестів, build/lint/lint:api/
typecheck:api — чисті.

**Ручна перевірка (з `npm run dev:api` + `ng serve --proxy-config`, реальний
MongoDB Atlas):** реєстрація → logout → login тим самим паролем — працює;
повторна реєстрація того ж email → «Цей email вже зареєстровано» /
«This email is already registered» (обидві мови); у Mongo лежить
bcrypt-хеш (`$2b$10$...`), не пароль (перевірено прямим запитом до
колекції `users`); підроблений JWT (зламаний підпис) і відсутній токен —
`requireAuth` відхиляє з 401; без логіну бібліотека/пошук/айтеми
працюють як раніше (нічого не заблоковано); rate limit на login —
`429` після 10 спроб/хв; 360px — без горизонтального скролу, шапка й
форма влазять; light-тема на `/auth` бере кольори з токенів. Тестові
акаунти видалено з Mongo після перевірки.

**Відомі обмеження (свідомо поза скоупом Step 07):** синк айтемів,
refresh-токени, відновлення пароля, OAuth — усе заборонено планом,
не робилося.
