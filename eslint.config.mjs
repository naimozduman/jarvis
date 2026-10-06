import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.agents/**',
      '.codex/**',
      '.github/**',
      '.next/**',
      '.turbo/**',
      'coverage/**',
      'dist/**',
      'docs/**',
      'evals/**',
      'node_modules/**',
      'prompts/**',
      'schemas/**',
      'templates/**',
      // Standalone reference toolkit has its own tests; application rules remain unchanged.
      'tools/jarvis-v5/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
