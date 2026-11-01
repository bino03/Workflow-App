import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountDirs, SHARED_DIRS } from '../src/accounts/accountDirs.js';
import { AppError } from '../src/common/errors.js';

/** A fake primary in a temporary folder — the real ~/.claude is never touched. */
describe('AccountDirs', () => {
  let root: string;
  let primaryDir: string;
  let primaryClaudeJson: string;
  let dirs: AccountDirs;
  const id = randomUUID();

  const expectAppError = async (work: () => Promise<unknown> | unknown, code: string) => {
    try {
      await work();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(code);
      return;
    }
    throw new Error(`expected ${code}`);
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wfa-accounts-'));
    primaryDir = join(root, 'primary');
    primaryClaudeJson = join(root, 'primary.claude.json');
    await mkdir(join(primaryDir, 'projects', 'C--proj'), { recursive: true });
    await writeFile(join(primaryDir, 'projects', 'C--proj', 'conversa.jsonl'), '{"type":"user"}\n');
    await mkdir(join(primaryDir, 'skills', 'minha-skill'), { recursive: true });
    await writeFile(join(primaryDir, 'skills', 'minha-skill', 'SKILL.md'), '# skill\n');
    await writeFile(join(primaryDir, 'settings.json'), '{"theme":"dark"}');
    await writeFile(join(primaryDir, 'CLAUDE.md'), '# global\n');
    await writeFile(join(primaryDir, 'keybindings.json'), '[]');
    await writeFile(
      primaryClaudeJson,
      JSON.stringify({ oauthAccount: { emailAddress: 'principal@example.com' }, mcpServers: { notion: { type: 'http', url: 'https://mcp.example.com' } } }),
    );
    dirs = new AccountDirs({ primaryDir, primaryClaudeJson, accountsDir: join(root, 'accounts') });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('create: the 6 shared folders are links to the primary (created there when missing)', async () => {
    await dirs.create(id);
    const dir = dirs.dirOf(id);
    expect(dir).toBe(join(root, 'accounts', id));
    for (const name of SHARED_DIRS) {
      expect((await lstat(join(dir, name))).isSymbolicLink()).toBe(true);
      expect(await realpath(join(dir, name))).toBe(await realpath(join(primaryDir, name)));
    }
    expect(existsSync(join(primaryDir, 'agents'))).toBe(true);
    expect(await readFile(join(dir, 'skills', 'minha-skill', 'SKILL.md'), 'utf8')).toBe('# skill\n');
  });

  it('the 3 files are copied, and removed from the account when the primary loses them', async () => {
    await dirs.create(id);
    const dir = dirs.dirOf(id);
    expect(await readFile(join(dir, 'settings.json'), 'utf8')).toBe('{"theme":"dark"}');
    expect(await readFile(join(dir, 'CLAUDE.md'), 'utf8')).toBe('# global\n');

    await writeFile(join(primaryDir, 'settings.json'), '{"theme":"light"}');
    await rm(join(primaryDir, 'keybindings.json'));
    await dirs.prepareForLaunch(id);
    expect(await readFile(join(dir, 'settings.json'), 'utf8')).toBe('{"theme":"light"}');
    expect(existsSync(join(dir, 'keybindings.json'))).toBe(false);
  });

  it('copies only mcpServers into the account .claude.json, keeping its login and trusted folders', async () => {
    await dirs.create(id);
    const path = dirs.claudeJsonOf(id);
    const own = { oauthAccount: { emailAddress: 'outra@example.com' }, projects: { 'C:/proj': { hasTrustDialogAccepted: true } } };
    await writeFile(path, JSON.stringify({ ...own, mcpServers: { velho: {} } }));

    await dirs.prepareForLaunch(id);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ ...own, mcpServers: { notion: { type: 'http', url: 'https://mcp.example.com' } } });

    await writeFile(primaryClaudeJson, JSON.stringify({ oauthAccount: { emailAddress: 'principal@example.com' } }));
    await dirs.prepareForLaunch(id);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(own);
  });

  it('an unreadable account .claude.json is never overwritten (it holds the login)', async () => {
    await dirs.create(id);
    await writeFile(dirs.claudeJsonOf(id), '{ broken');
    await expectAppError(() => dirs.prepareForLaunch(id), 'ACCOUNT_005');
    expect(await readFile(dirs.claudeJsonOf(id), 'utf8')).toBe('{ broken');
  });

  it('loginState reads the email and never exposes tokens', async () => {
    await dirs.create(id);
    expect(await dirs.loginState(id)).toEqual({ loggedIn: false, email: null });

    await writeFile(join(dirs.dirOf(id), '.credentials.json'), JSON.stringify({ claudeAiOauth: { accessToken: 'segredo', refreshToken: 'segredo' } }));
    await writeFile(dirs.claudeJsonOf(id), JSON.stringify({ oauthAccount: { emailAddress: 'outra@example.com', accountUuid: 'x' } }));
    const state = await dirs.loginState(id);
    expect(state).toEqual({ loggedIn: true, email: 'outra@example.com' });
    expect(JSON.stringify(state)).not.toContain('segredo');

    // The primary reads its .claude.json from where it lives (outside its config dir when CLAUDE_CONFIG_DIR is unset).
    expect(await dirs.loginState('primary')).toEqual({ loggedIn: false, email: 'principal@example.com' });
  });

  it('remove leaves the primary projects/ and skills/ intact', async () => {
    await dirs.create(id);
    await writeFile(join(dirs.dirOf(id), '.credentials.json'), '{}');
    await mkdir(join(dirs.dirOf(id), 'sessions'), { recursive: true });
    await dirs.remove(id);

    expect(existsSync(dirs.dirOf(id))).toBe(false);
    expect(await readFile(join(primaryDir, 'projects', 'C--proj', 'conversa.jsonl'), 'utf8')).toBe('{"type":"user"}\n');
    expect(await readFile(join(primaryDir, 'skills', 'minha-skill', 'SKILL.md'), 'utf8')).toBe('# skill\n');
    for (const name of SHARED_DIRS) expect(existsSync(join(primaryDir, name))).toBe(true);
  });

  it('a real folder where a link should be aborts with ACCOUNT_005 and deletes nothing', async () => {
    await dirs.create(id);
    const dir = dirs.dirOf(id);
    await rm(join(dir, 'skills')); // unlink only: the primary's skills stay
    expect(existsSync(join(primaryDir, 'skills', 'minha-skill', 'SKILL.md'))).toBe(true);
    await mkdir(join(dir, 'skills'));
    await writeFile(join(dir, 'skills', 'local.md'), 'x');

    await expectAppError(() => dirs.remove(id), 'ACCOUNT_005');
    expect(existsSync(join(dir, 'skills', 'local.md'))).toBe(true);
    expect((await lstat(join(dir, 'projects'))).isSymbolicLink()).toBe(true);
    await expectAppError(() => dirs.prepareForLaunch(id), 'ACCOUNT_005');
  });

  it('a link hidden deeper in the account folder aborts the removal before anything is deleted', async () => {
    await dirs.create(id);
    const dir = dirs.dirOf(id);
    await mkdir(join(dir, 'cache'), { recursive: true });
    await symlink(join(primaryDir, 'projects'), join(dir, 'cache', 'escondida'), 'junction');

    await expectAppError(() => dirs.remove(id), 'ACCOUNT_005');
    expect((await lstat(join(dir, 'projects'))).isSymbolicLink()).toBe(true);
    expect(existsSync(join(primaryDir, 'projects', 'C--proj', 'conversa.jsonl'))).toBe(true);
  });

  it('an id that is not a UUID never reaches a path', async () => {
    for (const bad of ['../fora', '..\\fora', 'C:\\Windows', '', 'primary2']) {
      await expectAppError(() => dirs.dirOf(bad), 'ACCOUNT_001');
      await expectAppError(() => dirs.create(bad), 'ACCOUNT_001');
      await expectAppError(() => dirs.remove(bad), 'ACCOUNT_001');
    }
    expect(existsSync(join(root, 'fora'))).toBe(false);
    expect(existsSync(join(root, 'accounts'))).toBe(false);
  });

  it('the primary: its own folder, no CLAUDE_CONFIG_DIR of ours, never removed', async () => {
    expect(dirs.dirOf('primary')).toBe(primaryDir);
    expect(dirs.configDirFor('primary')).toBeUndefined();
    expect(dirs.configDirFor(id)).toBe(join(root, 'accounts', id));
    expect(dirs.claudeJsonOf('primary')).toBe(primaryClaudeJson);
    await expectAppError(() => dirs.remove('primary'), 'ACCOUNT_003');
    await expectAppError(() => dirs.create('primary'), 'ACCOUNT_005');
  });

  it('a launch in an account whose folder disappeared recreates it, logged out', async () => {
    await dirs.prepareForLaunch(id);
    expect((await lstat(join(dirs.dirOf(id), 'projects'))).isSymbolicLink()).toBe(true);
    expect(await dirs.loginState(id)).toEqual({ loggedIn: false, email: null });
  });

  it('removing an account that has no folder is a no-op', async () => {
    await expect(dirs.remove(randomUUID())).resolves.toBeUndefined();
  });
});
