// @ts-check
// ESM (не CJS): корінь має "type": "module" — потрібно, щоб Vercel збирав
// функції як ESM (jose@6 — ESM-only і падав у CJS-збірці з ERR_REQUIRE_ESM).
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['eslint.config.js'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Дозволяє конвенцію "_ім'я" для навмисно невикористаних змінних —
      // зокрема паттерн `const { field: _field, ...rest } = obj` (strip полів
      // через деструктуризацію+rest), як у api/sync/items.ts stripDoc().
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    },
  },
);
