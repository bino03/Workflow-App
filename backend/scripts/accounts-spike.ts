/**
 * Manual spike (step 1 of docs/features/contas-do-claude.md, ADR 0027): does one CLAUDE_CONFIG_DIR per account
 * work, with the shared folders as junctions to the primary? The owner logs in to the second account once.
 *
 *   (a) a fresh CLAUDE_CONFIG_DIR asks for login, and after /login it has .credentials.json + oauthAccount;
 *   (b) with projects/ as a junction, the .jsonl is written through it, and --resume of a primary conversation works;
 *   (c) linked skills/plugins/mods show up, and a server copied into mcpServers of its .claude.json shows in /mcp
 *       and survives a full session (claude rewrites .claude.json);
 *   (d) the status line sees CLAUDE_CONFIG_DIR in its process.env and gets that account's rate_limits;
 *   (e) `claude "/login"` runs the slash command as the first message (owner observes);
 *   (f) unlink of each junction + rm of the account folder leaves the target untouched;
 *   (g) with a claude running in each account there are two supervisors (daemon.status.json in each folder).
 *
 * Never writes to ~/.claude or ~/.claude.json: the "primary" here is a COPY in a temporary folder (skills, plugins,
 * dev-mods, settings, one small conversation, the mcpServers key), and the second account links to that copy.
 *
 *   npx tsx scripts/accounts-spike.ts prepare   # builds the folders, opens a window with the login session
 *   npx tsx scripts/accounts-spike.ts live      # while that claude is still open: (g)
 *   npx tsx scripts/accounts-spike.ts resume    # opens a window with --resume of the copied conversation: (b)
 *   npx tsx scripts/accounts-spike.ts check     # after closing it: (a) (b) (c) (d), then (f) — removes the account
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveClaudeBin } from '../src/terminals/spawnClaude.js';

const SHARED_DIRS = ['projects', 'skills', 'plugins', 'agents', 'commands', 'dev-mods'];
const SYNCED_FILES = ['settings.json', 'CLAUDE.md', 'keybindings.json'];
const SPIKE_MCP = 'wfa-spike';

const root = join(tmpdir(), 'wfa-accounts-spike');
const primary = join(root, 'primary');
const account = join(root, 'account');
const workdir = join(root, 'workdir');
const statusCapture = join(root, 'statusline.jsonl');
const stateFile = join(root, 'spike.json');

const realClaude = join(homedir(), '.claude');
const realClaudeJson = join(homedir(), '.claude.json');
const encode = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, '-');
const log = (line: string) => console.log(line);
const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

/**
 * A small real conversation (has an assistant reply, under 2 MB) to copy into the fake primary — preferably one
 * from an earlier spike (a `wfa-*` temporary folder), so no project conversation is copied around.
 */
function pickConversation(): string {
  const candidates: { path: string; size: number; spike: boolean }[] = [];
  for (const project of readdirSync(join(realClaude, 'projects'))) {
    const dir = join(realClaude, 'projects', project);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
      const size = statSync(join(dir, file)).size;
      if (size < 2_000_000) candidates.push({ path: join(dir, file), size, spike: project.includes('-wfa-') });
    }
  }
  candidates.sort((a, b) => Number(b.spike) - Number(a.spike) || a.size - b.size);
  const found = candidates.find((c) => readFileSync(c.path, 'utf8').includes('"type":"assistant"'));
  if (!found) throw new Error('no small conversation with an assistant reply in ~/.claude/projects');
  return found.path;
}

/** A minimal stdio MCP server with one tool, so /mcp can show it connected. */
const MCP_SERVER = `const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\\n');
rl.on('line', (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.id === undefined) return;
  if (msg.method === 'initialize') send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: msg.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: '${SPIKE_MCP}', version: '1.0.0' } } });
  else if (msg.method === 'tools/list') send({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'spike_ping', description: 'Spike tool: answers pong.', inputSchema: { type: 'object', properties: {} } }] } });
  else if (msg.method === 'tools/call') send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'pong' }] } });
  else send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'not found' } });
});
`;

const STATUS_LINE = `const fs = require('node:fs');
let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  let data = {}; try { data = JSON.parse(input); } catch {}
  fs.appendFileSync(${JSON.stringify(statusCapture)}, JSON.stringify({ configDir: process.env.CLAUDE_CONFIG_DIR ?? null, sessionId: data.session_id ?? null, rateLimits: data.rate_limits ?? null }) + '\\n');
  process.stdout.write('wfa-accounts-spike · ' + (process.env.CLAUDE_CONFIG_DIR ? 'conta extra' : 'principal'));
});
`;

/** A .ps1 that sets CLAUDE_CONFIG_DIR only inside its own process, then runs claude interactively. */
function writeLauncher(name: string, claudeArgs: string[]): string {
  const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;
  const path = join(root, name);
  writeFileSync(
    path,
    [
      `$env:CLAUDE_CONFIG_DIR = ${quote(account)}`,
      `Set-Location ${quote(workdir)}`,
      `Write-Host 'CLAUDE_CONFIG_DIR =' $env:CLAUDE_CONFIG_DIR`,
      `& ${quote(resolveClaudeBin('claude'))} ${claudeArgs.map(quote).join(' ')}`,
      '',
    ].join('\r\n'),
  );
  return path;
}

function openWindow(script: string) {
  spawn('cmd.exe', ['/c', 'start', '"accounts-spike"', 'powershell.exe', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], {
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function prepare() {
  if (existsSync(root)) throw new Error(`${root} already exists — run "check" (it cleans up) or delete it first`);
  for (const dir of [primary, account, workdir]) mkdirSync(dir, { recursive: true });

  // The fake primary: copies of what the second account will share.
  for (const name of SHARED_DIRS) {
    const source = join(realClaude, name);
    if (name !== 'projects' && existsSync(source)) cpSync(source, join(primary, name), { recursive: true });
    else mkdirSync(join(primary, name), { recursive: true });
  }
  for (const name of SYNCED_FILES) if (existsSync(join(realClaude, name))) cpSync(join(realClaude, name), join(primary, name));
  const conversation = pickConversation();
  const resumeId = conversation.split(/[\\/]/).pop()!.replace(/\.jsonl$/, '');
  const projectDir = join(primary, 'projects', encode(workdir));
  mkdirSync(projectDir, { recursive: true });
  cpSync(conversation, join(projectDir, `${resumeId}.jsonl`));

  const mcpScript = join(root, 'mcp-server.cjs');
  writeFileSync(mcpScript, MCP_SERVER);
  const realServers = (readJson(realClaudeJson).mcpServers ?? {}) as Record<string, unknown>;
  const mcpServers = { ...realServers, [SPIKE_MCP]: { type: 'stdio', command: process.execPath, args: [mcpScript] } };
  writeFileSync(join(primary, '.claude.json'), JSON.stringify({ mcpServers }, null, 2));

  // The second account: junctions to the fake primary, the synced files, and only mcpServers in its .claude.json.
  for (const name of SHARED_DIRS) symlinkSync(join(primary, name), join(account, name), 'junction');
  for (const name of SYNCED_FILES) if (existsSync(join(primary, name))) cpSync(join(primary, name), join(account, name));
  writeFileSync(join(account, '.claude.json'), JSON.stringify({ mcpServers }, null, 2));

  const statusScript = join(root, 'statusline.cjs');
  writeFileSync(statusScript, STATUS_LINE);
  const settings = join(root, 'spike-settings.json');
  writeFileSync(settings, JSON.stringify({ statusLine: { type: 'command', command: `"${process.execPath}" "${statusScript}"` } }, null, 2));

  const fileCounts = Object.fromEntries(['projects', 'skills', 'plugins', 'dev-mods'].map((name) => [name, countFiles(join(primary, name))]));
  writeFileSync(stateFile, JSON.stringify({ resumeId, settings, conversationSource: conversation, fileCounts, mcpNames: Object.keys(mcpServers) }, null, 2));

  const login = writeLauncher('run-login.ps1', ['--settings', settings, '/login']);
  writeLauncher('run-resume.ps1', ['--settings', settings, '--resume', resumeId]);
  log(`prepared ${root}`);
  log(`  primary copy: ${primary}  (conversation ${resumeId}, MCP: ${Object.keys(mcpServers).join(', ')})`);
  log(`  account:      ${account}`);
  openWindow(login);
  log('opened a PowerShell window running: claude --settings <spike> "/login"  (CLAUDE_CONFIG_DIR = account)');
}

function countFiles(dir: string): number {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) count += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  return count;
}

function live() {
  check('(g) the account has its own supervisor (daemon.status.json)', existsSync(join(account, 'daemon.status.json')));
  check('(g) the primary keeps its own (~/.claude/daemon.status.json, read only)', existsSync(join(realClaude, 'daemon.status.json')));
  check('(g) the account registers its running claude in its own sessions/', existsSync(join(account, 'sessions')) && readdirSync(join(account, 'sessions')).length > 0);
  for (const name of SHARED_DIRS) check(`junction ${name} still a link while claude runs`, lstatSync(join(account, name)).isSymbolicLink());
}

function resume() {
  openWindow(join(root, 'run-resume.ps1'));
  log('opened a PowerShell window running: claude --resume <copied conversation>  (CLAUDE_CONFIG_DIR = account)');
}

function checkAndClean() {
  const state = readJson(stateFile) as { resumeId: string; fileCounts: Record<string, number>; mcpNames: string[] };

  // (a)
  const claudeJson = readJson(join(account, '.claude.json'));
  const oauth = claudeJson.oauthAccount as { emailAddress?: string } | undefined;
  check('(a) .credentials.json written in the account folder', existsSync(join(account, '.credentials.json')));
  check('(a) oauthAccount in the account .claude.json', !!oauth?.emailAddress, oauth?.emailAddress ?? 'none');

  // (b)
  const projectDir = join(primary, 'projects', encode(workdir));
  const jsonls = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
  check('(b) a new .jsonl landed in the primary copy, through the junction', jsonls.some((f) => !f.startsWith(state.resumeId)), jsonls.join(', '));
  check('(b) projects/ in the account is still a link, not a real folder', lstatSync(join(account, 'projects')).isSymbolicLink());

  // (c)
  const servers = Object.keys((claudeJson.mcpServers ?? {}) as Record<string, unknown>);
  check('(c) mcpServers survived the session (claude rewrites .claude.json)', state.mcpNames.every((n) => servers.includes(n)), servers.join(', '));

  // (d)
  const lines = existsSync(statusCapture)
    ? readFileSync(statusCapture, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as { configDir: string | null; rateLimits: unknown })
    : [];
  check('(d) the status line ran', lines.length > 0, `${lines.length} runs`);
  check('(d) it saw CLAUDE_CONFIG_DIR = the account folder', lines.length > 0 && lines.every((l) => l.configDir === account));
  const withLimits = lines.filter((l) => l.rateLimits);
  check('(d) it received rate_limits', withLimits.length > 0, JSON.stringify(withLimits.at(-1)?.rateLimits ?? null));

  // (f) the same order the backend will use: unlink each link (confirmed as a link), only then rm the folder.
  for (const name of SHARED_DIRS) {
    const path = join(account, name);
    if (!lstatSync(path).isSymbolicLink()) {
      check(`(f) ${name} is a link before removal`, false, 'a real folder — aborting, nothing deleted');
      return;
    }
    unlinkSync(path);
  }
  rmSync(account, { recursive: true });
  check('(f) the account folder is gone', !existsSync(account));
  for (const [name, before] of Object.entries(state.fileCounts)) {
    const after = countFiles(join(primary, name));
    // projects/ grew by the conversation the session wrote; nothing may be missing.
    check(`(f) primary ${name}/ intact`, name === 'projects' ? after >= before : after === before, `${before} → ${after}`);
  }
  log(failures === 0 ? '\nall automatic checks passed — (e) and the visual part of (b)/(c)/(g) are the owner’s' : `\n${failures} failed`);
  log(`the primary copy stays in ${primary} for inspection; delete ${root} when done`);
}

const command = process.argv[2];
if (command === 'prepare') prepare();
else if (command === 'live') live();
else if (command === 'resume') resume();
else if (command === 'check') checkAndClean();
else log('usage: npx tsx scripts/accounts-spike.ts prepare | live | resume | check');
process.exitCode = failures > 0 ? 1 : 0;
