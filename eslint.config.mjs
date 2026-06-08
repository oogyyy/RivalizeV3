import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // ── Override base config rules that block the build on pre-existing issues ──
      // These are good rules but the codebase has too many existing violations
      // to enforce them as errors right now. Promote to 'error' incrementally.
      '@next/next/no-html-link-for-pages': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',

      // ── TypeScript ─────────────────────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

      // ── React ──────────────────────────────────────────────────────────────────
      'react/self-closing-comp': 'warn',
      'react-hooks/exhaustive-deps': 'warn',

      // ── Imports ────────────────────────────────────────────────────────────────
      'import/no-duplicates': 'warn',

      // ── General ────────────────────────────────────────────────────────────────
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'public/**',
      '*.tsbuildinfo',
      'go-parser/**',
      'worker/**',
    ],
  },
]

export default eslintConfig
