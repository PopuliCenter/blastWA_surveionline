import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // backend = TypeScript (dicek terpisah via tsc); ESLint ini khusus frontend.
  // Jangan lint hasil build (dist, backend/dist) agar tak muncul error palsu.
  globalIgnores(['dist', 'backend']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Aturan DX/opini (bukan bug) → 'warn': terlihat tapi tak memblokir CI.
      // ui.jsx (design-system) & contactImport.jsx sengaja ekspor helper + komponen
      // dalam satu file; pola setState di effect (init/seleksi default) valid.
      // Aturan korektif (no-undef, rules-of-hooks, purity) tetap error.
      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
