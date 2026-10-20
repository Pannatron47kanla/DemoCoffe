import tseslint from 'typescript-eslint';
import boundaries from './eslint.boundaries.js';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'kiosk/.next/**', 'kiosk/out/**', 'kiosk/next-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // express ต้องมีพารามิเตอร์ครบ 4 ตัวใน error handler
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  ...boundaries,
];
