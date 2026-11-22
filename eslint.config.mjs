import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'playwright-report/**', 'test-results/**', '.dist-*/**'] },
  js.configs.recommended,
  { files: ['public/**/*.{js,mjs}'], languageOptions: { globals: globals.browser } },
  { files: ['tests/e2e/**/*.mjs'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/sw-template.js'], languageOptions: { globals: globals.serviceworker } },
  {
    files: ['scripts/*.mjs', '*.config.mjs', 'tests/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
];
