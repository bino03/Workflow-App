import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Many tests start and close real processes; closing lists the process tree (powershell) and waits for a
    // clean exit, which under the whole suite's parallel load goes past the 5 s default.
    testTimeout: 20_000,
  },
});
