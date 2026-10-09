import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

import { singleLineCommentStyle } from './eslint-rules/single-line-comment-style.ts';

/*
 * Tool config files whose loader requires a default export
 * (`eslint.config.ts`, `vitest.config.ts`, `tsdown.config.ts`, ...).
 */
const CONFIG_FILE_DEFAULT_EXPORT_FILES = ['*.config.{ts,mts,js,mjs}'];

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**', 'notes/**']),

  { linterOptions: { reportUnusedDisableDirectives: 'error' } },

  {
    files: ['**/*.{ts,mts,js,mjs}'],
    /*
     * Rules ported from eep-template-next-app, on a stricter base: the
     * type-aware `strict` + `stylistic` presets (as used by
     * create-typescript-app) replace eslint-config-next's TS preset.
     */
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        /*
         * `projectService` discovers the nearest tsconfig on demand - needed
         * for type-aware rules. Every linted file must be in a tsconfig
         * `include`, otherwise ESLint fails with "file not found by the
         * project service".
         */
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@stylistic': stylistic,
      local: {
        rules: {
          'single-line-comment-style': singleLineCommentStyle,
        },
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      /*
       * Named exports everywhere. Core-rule equivalent of next-app's
       * `import/no-default-export` - eslint-plugin-import does not support
       * ESLint 10.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Use named exports. Default exports only where a tool requires them.',
        },
        {
          selector: "ExportSpecifier[exported.name='default']",
          message:
            'Use named exports. Default exports only where a tool requires them.',
        },
      ],
      /*
       * The project comment contract, enforced in both directions and
       * auto-fixable via `eslint --fix`:
       *   - multi-line comments must be starred blocks, never stacked `//`
       *     lines (`multiline-comment-style`).
       *   - single-line comments must be `//`, never a block
       *     (`local/single-line-comment-style`).
       * TSDoc and tooling directives are exempt from both.
       */
      '@stylistic/multiline-comment-style': ['error', 'starred-block'],
      'local/single-line-comment-style': 'error',
    },
  },

  /*
   * TSDoc syntax + JSDoc presence enforcement.
   *   - `eslint-plugin-jsdoc` -> presence & structure (`require-jsdoc`, ...)
   *   - `eslint-plugin-tsdoc` -> syntax only (`tsdoc/syntax`)
   * jsdoc's own syntax checks are off so they don't fight tsdoc's stricter
   * TSDoc-spec validation.
   */
  {
    files: ['**/*.{ts,mts}'],
    plugins: { jsdoc, tsdoc },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      'tsdoc/syntax': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
        },
      ],
      'jsdoc/tag-lines': 'off',
      'jsdoc/check-tag-names': 'off',
      'jsdoc/require-param': ['error', { checkDestructured: false }],
      'jsdoc/check-param-names': 'off',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-param-type': 'off',
      'jsdoc/require-returns-type': 'off',
    },
  },

  // Tool config files must default-export (loader requirement).
  {
    files: CONFIG_FILE_DEFAULT_EXPORT_FILES,
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
