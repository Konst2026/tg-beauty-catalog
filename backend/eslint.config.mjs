// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  // Architecture rule: adapters/http must NOT import from infrastructure
  {
    files: ['src/adapters/http/**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/infrastructure',
                '@/infrastructure/*',
                '../../../infrastructure',
                '../../../infrastructure/*',
              ],
              message:
                'HTTP adapters must not import from infrastructure. Use Port interfaces injected from Composition Root.',
            },
          ],
        },
      ],
    },
  },
];
