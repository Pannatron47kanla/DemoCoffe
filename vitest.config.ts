import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    // repository / e2e เปิด Postgres ผ่าน Testcontainers ใช้เวลาเริ่มต้น
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
