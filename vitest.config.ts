import { defineConfig } from 'vitest/config';

// Окремий vitest для api/ — web/ тестується через власний builder Angular CLI
// (@angular/build:unit-test, керується з angular.json), цей конфіг його не чіпає.
export default defineConfig({
  test: {
    include: ['api/**/*.spec.ts'],
    environment: 'node',
  },
});
