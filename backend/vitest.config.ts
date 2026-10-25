import { defineConfig } from 'vitest/config';

/**
 * Files that start real processes: the fake `claude` in a real PTY, or powershell listings. Closing each terminal
 * costs ~1.6 s on Windows even for a fake that exits at once (powershell listing + ConPTY reporting the exit
 * ~1 s late); with all of them in parallel on a loaded machine (browser, java) they starved each other into
 * test and hook timeouts. A new test file that spawns processes belongs here.
 */
const PROCESS_TESTS = [
  'test/folders.sessions.routes.test.ts',
  'test/imports.routes.test.ts',
  'test/keybindings.test.ts',
  'test/listeningPorts.test.ts',
  'test/preview.routes.test.ts',
  'test/telegramBot.test.ts',
  'test/terminalManager.test.ts',
  'test/terminals.gateway.test.ts',
  'test/terminals.routes.test.ts',
  'test/terminalsService.test.ts',
  'test/workflowGit.test.ts',
];

const shared = {
  environment: 'node' as const,
  // Closing a real process lists the tree (powershell) and waits for a clean exit — past the 5 s default.
  testTimeout: 20_000,
  // The afterEach/beforeEach hooks close several of them; under load the 10 s default ran out.
  hookTimeout: 30_000,
};

export default defineConfig({
  test: {
    projects: [
      { test: { ...shared, name: 'unit', include: ['test/**/*.test.ts'], exclude: PROCESS_TESTS } },
      // At most 3 at a time, after the unit project (Vitest runs projects with different maxWorkers in turn).
      {
        test: { ...shared, name: 'processes', include: PROCESS_TESTS, maxWorkers: 3, sequence: { groupOrder: 1 } },
      },
    ],
  },
});
