// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

module.exports = tseslint.config(
  { ignores: ['eslint.config.js'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
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
