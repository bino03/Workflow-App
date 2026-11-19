import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { classify, gitEnv } from '../src/projectInfo/projectGit.js';
import type { ProjectInfo } from '../src/state/state.schema.js';
import { TerminalManager } from '../src/terminals/terminalManager.js';
import { TEST_USERNAME, testConfig, testStateStore } from './helpers.js';

const PASSWORD = 'project git sync test password';

let base: string;
let root: string;
let workflow: string;
let origin: string;
let dev: string;
let clone: string;
let passwordHash: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();

let counter = 0;
/** A commit on `branch` in the "developer" clone, pushed to origin — what a merge on GitHub looks like from here. */
function pushCommit(subject: string, branch = 'main'): string {
  writeFileSync(join(dev, `file-${counter++}.txt`), subject);
  git(dev, 'add', '.');
  git(dev, 'commit', '-q', '-m', subject);
  git(dev, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`);
  return git(dev, 'rev-parse', 'HEAD');
}

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'wfa-project-git-'));
  root = join(base, 'root');
  workflow = join(base, 'workflow');
  origin = join(root, 'origin.git');
  dev = join(root, 'dev');
  clone = join(root, 'worksite');
  mkdirSync(join(workflow, 'projects'), { recursive: true });
  mkdirSync(join(root, 'plain'), { recursive: true });
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, dev);
  git(dev, 'config', 'user.email', 'test@example.com');
  git(dev, 'config', 'user.name', 'Test');
  pushCommit('first commit');
  git(root, 'clone', '-q', origin, clone);
  // The registry points at a subfolder of the repository, like Worksite\Worksite.
  mkdirSync(join(clone, 'app'), { recursive: true });
  writeFileSync(
    join(workflow, 'projects', 'INDEX.md'),
    [
      `Pasta base: \`${base}\``,
      '',
      '| Projeto | Caminho (relativo à base) | Tipo | Stack (resumo) | Entrada | Vault | Estado |',
      '|---|---|---|---|---|---|---|',
      `| **Worksite** | \`${join('root', 'worksite', 'app')}\` | meu | Node | \`CLAUDE.md\` | ✅ | ativo |`,
      `| **Plain** | \`${join('root', 'plain')}\` | meu | Node | \`CLAUDE.md\` | ✅ | ativo |`,
      '',
    ].join('\n'),
  );
  passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe('POST /api/project-infos/git-sync (ADR 0034, 0035)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let worksite: string;
  let plain: string;

  async function start(overrides: Record<string, string> = {}) {
    const config = testConfig({ WORKFLOW_PATH: workflow, ALLOWED_ROOTS: root, APP_PASSWORD_HASH: passwordHash, ...overrides });
    const terminalManager = new TerminalManager({ spawn: () => { throw new Error('no spawn'); }, maxTerminals: 1, scrollbackBytes: 1024 });
    app = await buildApp({ stateStore: await testStateStore(), config, terminalManager, logger: false });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: TEST_USERNAME, password: PASSWORD } });
    cookie = `session=${login.cookies.find((c) => c.name === 'session')!.value}`;
    const projects = (await call('GET', '/api/projects')).json<{ name: string; path: string }[]>();
    worksite = projects.find((p) => p.name === 'Worksite')!.path;
    plain = projects.find((p) => p.name === 'Plain')!.path;
  }

  beforeEach(async () => start());
  afterEach(async () => {
    await app.close();
  });

  const call = (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });
  const put = (environments: object[], target = worksite) => call('PUT', '/api/project-infos', { projectPath: target, info: { environments } });
  const sync = (target = worksite) => call('POST', '/api/project-infos/git-sync', { projectPath: target });
  type SyncBody = { info: ProjectInfo | null; warnings: { environmentId: string; reason: string }[] };
  const production = (extra: object = {}) => ({ kind: 'production', name: 'Produção', deployBranch: 'main', ...extra });

  it('needs a session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/project-infos/git-sync', payload: { projectPath: worksite } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ errorCode: 'AUTH_002' });
  });

  it('PROJECT_001 outside the registry; COMMON_001 without a path', async () => {
    expect((await sync(join(root, 'dev'))).json()).toMatchObject({ errorCode: 'PROJECT_001' });
    const res = await call('POST', '/api/project-infos/git-sync', {});
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ errorCode: 'COMMON_001' });
  });

  it('refuses an invalid deploy branch on PUT (400), and keeps the "branch / versão" free text', async () => {
    for (const deployBranch of ['--upload-pack=touch x', '-main', 'a..b', 'feat/', '.hidden', 'x.lock', 'a b', 'a:b']) {
      const res = await put([production({ deployBranch })]);
      expect(res.statusCode, deployBranch).toBe(400);
      expect(res.json()).toMatchObject({ errorCode: 'COMMON_001' });
    }
    const ok = await put([production({ deployBranch: 'release/1.2', version: 'main · qualquer texto' })]);
    expect(ok.statusCode).toBe(200);
    expect(ok.json<ProjectInfo>().environments[0]).toMatchObject({ deployBranch: 'release/1.2', version: 'main · qualquer texto', lastGitCommit: null });
  });

  it('without a deploy branch it does nothing: no git, no deploys', async () => {
    await put([{ kind: 'production', name: 'Produção' }]);
    const body = (await sync()).json<SyncBody>();
    expect(body).toEqual({ info: expect.anything(), warnings: [] });
    expect(body.info!.environments[0]!.deploys).toEqual([]);
  });

  it('a new tip → one git deploy (short hash, subject, committer date); the same commit again → nothing', async () => {
    await put([production()]);
    const tip = pushCommit('Merge pull request #12 from feat/login');
    const first = (await sync()).json<SyncBody>();
    expect(first.warnings).toEqual([]);
    const env = first.info!.environments[0]!;
    expect(env.lastGitCommit).toBe(tip);
    expect(env.deploys).toHaveLength(1);
    const committed = git(clone, 'log', '-1', '--format=%cI', 'refs/remotes/origin/main');
    expect(env.deploys[0]).toMatchObject({
      source: 'git',
      commit: tip,
      version: tip.slice(0, 7),
      note: 'Merge pull request #12 from feat/login',
      at: new Date(committed).toISOString(),
    });

    const again = (await sync()).json<SyncBody>();
    expect(again.info!.environments[0]!.deploys).toHaveLength(1);

    const next = pushCommit('second deploy');
    const third = (await sync()).json<SyncBody>();
    expect(third.info!.environments[0]!.deploys.map((d) => d.commit)).toEqual([next, tip]);
    // The working tree and HEAD of the owner's clone never move.
    expect(git(clone, 'status', '--porcelain')).toBe('');
    expect(git(clone, 'rev-parse', 'HEAD')).not.toBe(next);
  });

  it('a deleted git deploy does not come back while the tip stays the same', async () => {
    await put([production()]);
    pushCommit('deploy to delete');
    const info = (await sync()).json<SyncBody>().info!;
    const env = info.environments[0]!;
    const query = new URLSearchParams({ projectPath: worksite, environmentId: env.id, deployId: env.deploys[0]!.id });
    expect((await call('DELETE', `/api/project-infos/deploys?${query.toString()}`)).statusCode).toBe(200);
    expect((await sync()).json<SyncBody>().info!.environments[0]!.deploys).toEqual([]);
  });

  it('ADR 0035: the same tip → ls-remote only, no fetch; a new tip right after → fetched, no interval', async () => {
    await put([production()]);
    const first = (await sync()).json<SyncBody>();
    expect(first.info!.environments[0]!.lastGitCommit).toBe(git(dev, 'rev-parse', 'HEAD'));
    // Without the remote ref in the clone, only a fetch could bring it back.
    git(clone, 'update-ref', '-d', 'refs/remotes/origin/main');
    expect((await sync()).json<SyncBody>()).toMatchObject({ warnings: [] });
    expect(() => git(clone, 'rev-parse', '--verify', '-q', 'refs/remotes/origin/main')).toThrow();

    const next = pushCommit('right after');
    const body = (await sync()).json<SyncBody>();
    expect(body.info!.environments[0]!.lastGitCommit).toBe(next);
    expect(git(clone, 'rev-parse', 'refs/remotes/origin/main')).toBe(next);
    expect(body).not.toHaveProperty('skipped');
  });

  it('ls-remote counts only the exact ref: a branch that merely ends in refs/heads/<b> is no-branch', async () => {
    pushCommit('decoy', 'decoy/refs/heads/release');
    const saved = (await put([production({ deployBranch: 'release' })])).json<ProjectInfo>();
    expect((await sync()).json<SyncBody>().warnings).toEqual([{ environmentId: saved.environments[0]!.id, reason: 'no-branch' }]);
  });


  it('a manual deploy cannot claim to come from git', async () => {
    const env = (await put([production()])).json<ProjectInfo>().environments[0]!;
    const res = await call('POST', '/api/project-infos/deploys', {
      projectPath: worksite,
      environmentId: env.id,
      source: 'git',
      commit: 'a'.repeat(40),
    });
    expect(res.json<ProjectInfo>().environments[0]!.deploys[0]).toMatchObject({ source: 'manual', commit: null });
  });

  it('warnings, never errors: a branch the remote lacks, a folder that is not a repository, no git at all', async () => {
    const saved = (await put([production(), { kind: 'staging', name: 'Staging', deployBranch: 'nope' }])).json<ProjectInfo>();
    const res = await sync();
    expect(res.statusCode).toBe(200);
    const body = res.json<SyncBody>();
    expect(body.warnings).toEqual([{ environmentId: saved.environments[1]!.id, reason: 'no-branch' }]);
    expect(body.info!.environments[0]!.deploys.length).toBeGreaterThan(0);

    const plainEnv = (await put([production()], plain)).json<ProjectInfo>().environments[0]!;
    expect((await sync(plain)).json<SyncBody>().warnings).toEqual([{ environmentId: plainEnv.id, reason: 'no-repo' }]);

    await app.close();
    await start({ GIT_BIN: join(base, 'no-such-git.exe') });
    const env = (await put([production()])).json<ProjectInfo>().environments[0]!;
    expect((await sync()).json<SyncBody>().warnings).toEqual([{ environmentId: env.id, reason: 'no-git' }]);
  });

  it('a repository whose origin is missing gives no-remote', async () => {
    const lonely = join(root, 'plain', 'lonely');
    mkdirSync(lonely, { recursive: true });
    git(lonely, 'init', '-q');
    // Not in the registry: the git layer is exercised through the classifier, which is what decides the reason.
    let stderr = '';
    try {
      execFileSync('git', ['fetch', 'origin', '+refs/heads/main:refs/remotes/origin/main'], { cwd: lonely, stdio: 'pipe', env: gitEnv() });
    } catch (error) {
      stderr = String((error as { stderr?: Buffer }).stderr ?? '');
      expect(classify(Object.assign(new Error('x'), { stderr, code: 128 }), 'fetch')).toBe('no-remote');
    }
    expect(stderr).not.toBe('');
    stderr = '';
    try {
      execFileSync('git', ['ls-remote', '--end-of-options', 'origin', 'refs/heads/main'], { cwd: lonely, stdio: 'pipe', env: gitEnv() });
    } catch (error) {
      stderr = String((error as { stderr?: Buffer }).stderr ?? '');
      expect(classify(Object.assign(new Error('x'), { stderr, code: 128 }), 'ls-remote')).toBe('no-remote');
    }
    expect(stderr).not.toBe('');
  });
});

describe('gitEnv', () => {
  it('never prompts, and keeps the owner’s own SSH command', () => {
    expect(gitEnv({})).toMatchObject({ GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' });
    expect(gitEnv({ GIT_SSH_COMMAND: 'plink' }).GIT_SSH_COMMAND).toBe('plink');
    expect(gitEnv({ GIT_SSH: 'plink.exe' }).GIT_SSH_COMMAND).toBeUndefined();
  });

  it('classifies timeouts and a missing binary', () => {
    expect(classify(Object.assign(new Error('x'), { code: 'ENOENT' }), 'fetch')).toBe('no-git');
    expect(classify(Object.assign(new Error('x'), { killed: true, signal: 'SIGTERM' }), 'fetch')).toBe('timeout');
    expect(classify(Object.assign(new Error('x'), { stderr: 'fatal: Authentication failed' }), 'fetch')).toBe('fetch-failed');
  });
});
