import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DeployTrigger } from '../src/projectInfo/deployTrigger.js';
import { SESSION_STATE_FILES } from '../src/terminals/sessionState.js';
import { waitFor } from './fakeClaude.js';
import { removeDir } from './helpers.js';

const TERMINAL = '6f1f2a7e-3b0c-4c8e-9a51-2d7f0e4b9c11';
const OTHER = '0b9e3c1d-2a4f-4e5b-8c6d-7e8f9a0b1c2d';

let dataDir: string;
let projects: string;
let trigger: DeployTrigger;
let synced: string[];

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'wfa-deploy-trigger-'));
  projects = join(dataDir, 'roots');
  synced = [];
  const cwds: Record<string, string> = {
    [TERMINAL]: join(projects, 'alfa', 'app', 'src'),
    [OTHER]: join(projects, 'beta'),
  };
  trigger = new DeployTrigger({
    dataDir,
    terminalCwd: (id) => cwds[id] ?? null,
    projectPaths: async () => [join(projects, 'alfa'), join(projects, 'alfa', 'app'), join(projects, 'beta')],
    projectInfo: {
      // beta has no deploy branch.
      hasDeployBranch: (path) => !path.endsWith('beta'),
      syncFromGit: async (path) => {
        synced.push(path);
        return { info: null, warnings: [] };
      },
    },
    log: { info: () => {}, warn: () => {} } as unknown as FastifyBaseLogger,
    debounceMs: 50,
  });
  trigger.start();
});
afterEach(async () => {
  await trigger.stop();
  removeDir(dataDir);
});

function mark(id: string, at: string) {
  const dir = join(dataDir, SESSION_STATE_FILES.dir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'push.json.tmp'), JSON.stringify({ at }));
  writeFileSync(join(dir, SESSION_STATE_FILES.push), JSON.stringify({ at }));
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DeployTrigger (ADR 0035)', () => {
  it('a push marker syncs the deepest registry project holding the terminal cwd, once per marker', async () => {
    mark(TERMINAL, '2026-11-19T10:00:00.000Z');
    await waitFor(() => synced.length > 0, 5_000);
    await pause(300);
    expect(synced).toEqual([join(projects, 'alfa', 'app')]);

    // The same marker again (a rename fires twice) → nothing; a new one → another sync.
    mark(TERMINAL, '2026-11-19T10:00:00.000Z');
    await pause(300);
    expect(synced).toHaveLength(1);
    mark(TERMINAL, '2026-11-19T10:05:00.000Z');
    await waitFor(() => synced.length === 2, 5_000);
  });

  it('a project without a deploy branch, an unknown terminal and other files never sync', async () => {
    mark(OTHER, '2026-11-19T10:00:00.000Z');
    mark('a5c1e2d3-0000-4000-8000-000000000000', '2026-11-19T10:00:00.000Z');
    const dir = join(dataDir, SESSION_STATE_FILES.dir, TERMINAL);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, SESSION_STATE_FILES.state), JSON.stringify({ activity: 'working' }));
    await pause(500);
    expect(synced).toEqual([]);
  });
});
