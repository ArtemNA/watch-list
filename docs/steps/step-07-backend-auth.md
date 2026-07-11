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

_(заповнює виконавець)_
