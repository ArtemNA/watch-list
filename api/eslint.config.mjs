// @ts-check
// .mjs: ESM-синтаксис без type:module у корені. type:module у package.json
// НЕ МОЖНА: @vercel/node компілює функції з залежностями у CJS (.js з
// exports), і під type:module Node виконує їх як ESM → "exports is not
// defined in ES module scope" на проді.
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['eslint.config.mjs'] },
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
