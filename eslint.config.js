import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

// Single flat config for BOTH npm packages in this repo: the extension at the
// root and the landing site under landing/. They have separate package.json /
// tsconfig / vitest setups, but linting is a whole-repo concern so one config
// keeps the rules from drifting apart.
//
// Deliberately NOT type-aware (no recommendedTypeChecked): `vue-tsc --noEmit`
// already runs in CI for both packages and covers type correctness. Type-aware
// linting here would need two tsconfig projects wired up and would make the
// lint step several times slower for rules we already enforce.
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      '.output/**',
      '.wxt/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'landing/dist/**',
      '**/.netlify/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],

  // .vue <script lang="ts"> blocks: vue-eslint-parser handles the SFC, and
  // delegates the script body to the TypeScript parser.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // Extension + landing browser-side source.
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Unused args are fine when they document a callback's signature;
      // an underscore prefix is the opt-out.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // Formatting-only Vue rules. This repo has no Prettier/formatter, so
      // these would produce churn without catching defects.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      // Entry SFCs are legitimately named App.vue.
      'vue/multi-word-component-names': 'off',
    },
  },

  // Build/release scripts: plain Node ESM, no DOM.
  {
    // '**/*.config.*' not '*.config.*': the bare form only matches the repo root,
    // which left landing/vite.config.ts and landing/vitest.config.ts resolving as
    // browser code (window defined, __dirname not) even though they are Node.
    files: ['scripts/**/*.mjs', 'landing/scripts/**/*.mjs', '**/*.config.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Scripts that drive a headless browser: the bodies of their page.evaluate()
  // callbacks are serialised and run IN the page, so window/document/chrome are
  // genuinely in scope there even though the module itself is Node.
  {
    files: ['scripts/make-promo-video.mjs', 'landing/scripts/prerender.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, chrome: 'readonly' },
    },
  },

  // public/ ships plain browser scripts (loaded as external files to satisfy
  // the extension's script-src 'self' CSP) — not part of the TS build.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },

  // Playwright e2e runs in Node and drives a browser.
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  // Tests: `any` and non-null assertions are pragmatic in fixtures and mocks.
  {
    files: ['tests/**/*.ts', 'landing/src/**/*.test.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
