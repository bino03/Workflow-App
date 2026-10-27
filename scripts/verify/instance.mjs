// Throwaway backend instance for browser checks: its own port, generated login, DATA_DIR, ALLOWED_ROOTS,
// CLAUDE_CONFIG_DIR and (unless --workflow) a fake Workflow with test projects. Never touches the
// owner's state.json, sessions or bot. Serves frontend/dist (build it first).
//
//   node scripts/verify/instance.mjs start [--port 7498] [--dir <run dir>] [--fresh] [--projects 3]
//                                          [--sessions] [--workflow <real Workflow path>] [--git-workflow]
//                                          [--real-claude]   (with --workflow: the owner's ~/.claude — spends quota)
//                                          [--portfolio <path>]  (PORTFOLIO_PATH, read-only — ADR 0024; omitted = unset)
//   node scripts/verify/instance.mjs stop  [--port 7498] [--dir <run dir>] [--clean]
//
// start prints the run dir; <run dir>/instance.json has the URL, username and password for the driver.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const REPO = resolve(import.meta.dirname, '..', '..');
const BACKEND = join(REPO, 'backend');
// The owner's instances (backend and Vite) — never started over nor stopped by this script.
const OWNER_PORTS = new Set([7400, 7401]);

const { positionals, values: opts } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '7498' },
    dir: { type: 'string' },
    fresh: { type: 'boolean', default: false },
    projects: { type: 'string', default: '3' },
    sessions: { type: 'boolean', default: false },
    workflow: { type: 'string' },
    'git-workflow': { type: 'boolean', default: false },
    'real-claude': { type: 'boolean', default: false },
    portfolio: { type: 'string' },
    clean: { type: 'boolean', default: false },
  },
});
const port = Number(opts.port);
if (!Number.isInteger(port) || OWNER_PORTS.has(port)) fail(`--port ${opts.port}: not allowed (the owner's ports are ${[...OWNER_PORTS].join(', ')})`);
const runDir = resolve(opts.dir ?? join(tmpdir(), `wfa-verify-${port}`));
const base = `http://localhost:${port}`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function healthy() {
  try {
    return (await fetch(`http://127.0.0.1:${port}/api/health`)).ok;
  } catch {
    return false;
  }
}

/** PIDs listening on the port (netstat, so it works without PowerShell modules). */
function listeners() {
  const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols[0] === 'TCP' && cols[1]?.endsWith(`:${port}`) && cols[3] === 'LISTENING') pids.add(cols[4]);
  }
  return [...pids];
}

/** Claude Code stores a cwd's sessions under projects/<path with every non-alphanumeric char as '-'>. */
const encodeCwd = (path) => path.replace(/[^A-Za-z0-9]/g, '-');

function seedSessions(claudeDir, cwd) {
  const dir = join(claudeDir, 'projects', encodeCwd(cwd));
  mkdirSync(dir, { recursive: true });
  const sessions = [
    ['11111111-1111-4111-8111-111111111111', 'Sessao de teste A'],
    ['22222222-2222-4222-8222-222222222222', 'Sessao de teste B'],
  ];
  for (const [id, text] of sessions) {
    const lines = [
      { type: 'user', timestamp: '2026-10-20T10:00:00.000Z', message: { role: 'user', content: text } },
      { type: 'assistant', timestamp: '2026-10-20T10:00:05.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } },
    ];
    writeFileSync(join(dir, `${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  }
}

/**
 * The fake Workflow as a clean git repository that this instance's Claude Code already trusts — what an import
 * needs (ADR 0019). The instance's CLAUDE_CONFIG_DIR has no login, so its claude never runs /import: a check
 * writes what the skill would (files in the repo, result.json) by hand.
 */
function gitWorkflow(workflowPath, claudeDir) {
  const git = (...args) => execFileSync('git', args, { cwd: workflowPath, windowsHide: true, stdio: 'ignore' });
  git('init', '-q');
  git('config', 'user.email', 'verifier@example.com');
  git('config', 'user.name', 'verifier');
  writeFileSync(join(workflowPath, 'README.md'), '# Workflow (verificação)\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  mkdirSync(claudeDir, { recursive: true });
  const key = resolve(workflowPath).replace(/\\/g, '/');
  writeFileSync(join(claudeDir, '.claude.json'), JSON.stringify({ projects: { [key]: { hasTrustDialogAccepted: true } } }));
}

async function start() {
  if (listeners().length > 0) fail(`port ${port} is already in use — stop it first (instance.mjs stop --port ${port})`);
  const dist = join(REPO, 'frontend', 'dist');
  if (!existsSync(join(dist, 'index.html'))) fail('frontend/dist/index.html missing — run `npm run build` in frontend/ first');

  if (opts.fresh) rmSync(runDir, { recursive: true, force: true });
  const dataDir = join(runDir, 'data');
  const rootsDir = join(runDir, 'roots');
  const claudeDir = join(runDir, 'claude');
  for (const d of [dataDir, rootsDir, claudeDir]) mkdirSync(d, { recursive: true });

  const names = ['Alfa', 'Beta', 'Gama', 'Delta', 'Epsilon', 'Zeta'].slice(0, Number(opts.projects));
  const projectDirs = names.map((name) => join(rootsDir, `proj-${name.toLowerCase()}`));
  for (const d of projectDirs) mkdirSync(d, { recursive: true });

  let workflowPath;
  if (opts.workflow) {
    workflowPath = resolve(opts.workflow);
    if (!existsSync(workflowPath)) fail(`--workflow ${workflowPath}: does not exist`);
  } else {
    // --git-workflow: inside ALLOWED_ROOTS, so the imports (ADR 0019) can run their terminal there.
    workflowPath = opts['git-workflow'] ? join(rootsDir, 'workflow') : join(runDir, 'workflow');
    mkdirSync(join(workflowPath, 'projects'), { recursive: true });
    mkdirSync(join(workflowPath, 'library', 'stacks'), { recursive: true });
    const rows = names.map((name) => `|${name} | proj-${name.toLowerCase()} | app | — | ativo |`);
    writeFileSync(
      join(workflowPath, 'projects', 'INDEX.md'),
      `# Projetos\n\nPasta base: \`${rootsDir}\\\`\n\n| Projeto | Caminho | Tipo | Stack | Estado |\n|---|---|---|---|---|\n${rows.join('\n')}\n`,
    );
  }
  if (opts['git-workflow'] && !opts.workflow) gitWorkflow(workflowPath, claudeDir);
  const portfolioPath = opts.portfolio ? resolve(opts.portfolio) : '';
  if (portfolioPath && !existsSync(portfolioPath)) fail(`--portfolio ${portfolioPath}: does not exist`);
  if (opts.sessions && projectDirs.length > 1) seedSessions(claudeDir, projectDirs[1]);

  // A fresh login on every start: nothing reusable outlives the run dir.
  const realClaude = opts['real-claude'];
  if (realClaude && !opts.workflow) fail('--real-claude needs --workflow <the real Workflow path>');
  const argon2 = createRequire(join(BACKEND, 'package.json'))('argon2');
  const username = 'verifier';
  const password = randomBytes(18).toString('base64url');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  // Every variable the owner's backend/.env sets is overridden here: loadEnvFile never replaces one that
  // already exists, so whatever is left out would leak in (the Telegram token above all — two backends
  // with the same token fight over getUpdates).
  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    LOG_LEVEL: 'info',
    APP_USERNAME: username,
    APP_PASSWORD_HASH: passwordHash,
    SESSION_SECRET: randomBytes(48).toString('hex'),
    COOKIE_SECURE: 'false',
    CORS_ALLOWED_ORIGINS: `${base},http://127.0.0.1:${port}`,
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGINS: '',
    // --real-claude: the owner's Claude Code (login, trusted folders) can run an import in the real Workflow,
    // which must then be a root too. Only with --workflow; it spends quota and writes in that repo.
    ALLOWED_ROOTS: realClaude ? `${rootsDir};${workflowPath}` : rootsDir,
    DEFAULT_CWD: '',
    CLAUDE_CONFIG_DIR: realClaude ? '' : claudeDir,
    MAX_TERMINALS: '12',
    WORKFLOW_PATH: workflowPath,
    // Only read (the screenshots an application attaches); empty = unset, whatever the owner's .env says.
    PORTFOLIO_PATH: portfolioPath,
    DATA_DIR: dataDir,
    FRONTEND_DIST: dist,
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_ALLOWED_USER_ID: '',
  };

  const logFile = join(runDir, 'backend.log');
  const log = openSync(logFile, 'w');
  // tsx without watch: a save in backend/ must not restart (and kill) the instance mid-check.
  const child = spawn(process.execPath, [join(BACKEND, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'], {
    cwd: BACKEND,
    env,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.unref();

  for (let i = 0; i < 120 && !(await healthy()); i++) {
    if (child.exitCode !== null) break;
    await sleep(250);
  }
  if (!(await healthy())) fail(`instance did not come up — see ${logFile}\n${readFileSync(logFile, 'utf8').slice(-2000)}`);

  writeFileSync(
    join(runDir, 'instance.json'),
    JSON.stringify({ base, port, username, password, runDir, rootsDir, workflowPath, portfolioPath, claudeDir, dataDir, projects: Object.fromEntries(names.map((n, i) => [n, projectDirs[i]])) }, null, 2),
  );
  console.log(`up on ${base} (pid ${child.pid})`);
  console.log(runDir);
}

async function stop() {
  const pids = listeners();
  // /T: the tree — the terminals' claude processes are children of the backend.
  for (const pid of pids) {
    try {
      execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
      console.log(`stopped ${pid}`);
    } catch {
      console.log(`could not stop ${pid}`);
    }
  }
  for (let i = 0; i < 20 && (await healthy()); i++) await sleep(250);
  if (await healthy()) fail(`port ${port} still answers /api/health`);
  console.log(`port ${port} free`);
  if (opts.clean) {
    rmSync(runDir, { recursive: true, force: true });
    console.log(`removed ${runDir}`);
  }
}

const command = positionals[0];
if (command === 'start') await start();
else if (command === 'stop') await stop();
else fail('usage: instance.mjs start|stop [options] — see the header of this file');
