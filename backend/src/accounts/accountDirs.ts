import { copyFile, lstat, mkdir, readdir, readFile, rm, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { AppError } from '../common/errors.js';
import { claudeJsonPath } from '../sessions/claudeTrust.js';
import { atomicWrite } from '../state/atomicWrite.js';
import type { AccountId } from '../state/state.schema.js';

/**
 * Shared with the primary through a junction (a symlink outside Windows): one Resume list, the same memory,
 * skills, plugins and mods. The supervisor (`daemon/`, `daemon.lock`) and `sessions/` stay per account on
 * purpose — two supervisors writing to one place would trip over each other (ADR 0027).
 */
export const SHARED_DIRS = ['projects', 'skills', 'plugins', 'agents', 'commands', 'dev-mods'] as const;

/** Copied from the primary before each launch: a file cannot be linked on Windows without privileges. */
export const SYNCED_FILES = ['settings.json', 'CLAUDE.md', 'keybindings.json'] as const;

export type LoginState = { loggedIn: boolean; email: string | null };

export type AccountDirsOptions = {
  /** The primary's config dir (`CLAUDE_CONFIG_DIR`, else `~/.claude`). */
  primaryDir: string;
  /** The primary's `.claude.json` — outside its config dir when `CLAUDE_CONFIG_DIR` is not set. */
  primaryClaudeJson: string;
  /** `DATA_DIR/accounts`: one folder per extra account, named by its id. */
  accountsDir: string;
};

const uuid = z.uuid();
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

async function readJsonObject(path: string): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${path} is not a JSON object`);
  return parsed as Record<string, unknown>;
}

/**
 * The folders of the Claude accounts (ADR 0027, spec contas-do-claude §4.1). A path is always derived from an
 * id validated here — never taken from a request. Deleting is the dangerous part: a junction followed by a
 * recursive delete would empty the primary's conversations, so `remove` only deletes after every link inside
 * the folder is gone.
 */
export class AccountDirs {
  constructor(private readonly options: AccountDirsOptions) {}

  static fromConfig(config: { terminals: { claudeConfigDir: string | undefined }; dataDir: string }): AccountDirs {
    const { claudeConfigDir } = config.terminals;
    return new AccountDirs({
      primaryDir: claudeConfigDir ?? join(homedir(), '.claude'),
      primaryClaudeJson: claudeJsonPath(claudeConfigDir),
      accountsDir: join(config.dataDir, 'accounts'),
    });
  }

  /** The config dir of an account. An extra id that is not a UUID never reaches a path: ACCOUNT_001. */
  dirOf(id: AccountId): string {
    if (id === 'primary') return this.options.primaryDir;
    if (!uuid.safeParse(id).success) throw new AppError('ACCOUNT_001');
    return join(this.options.accountsDir, id);
  }

  /** `undefined` for the primary: its claude keeps today's environment (no CLAUDE_CONFIG_DIR of ours). */
  configDirFor(id: AccountId): string | undefined {
    return id === 'primary' ? undefined : this.dirOf(id);
  }

  claudeJsonOf(id: AccountId): string {
    return id === 'primary' ? this.options.primaryClaudeJson : join(this.dirOf(id), '.claude.json');
  }

  /** A new extra account: its folder, the links to the primary, and the synced files. */
  async create(id: string): Promise<void> {
    const dir = this.extraDir(id);
    await this.guard(() => mkdir(dir, { recursive: true }));
    await this.prepareForLaunch(id);
  }

  /**
   * Before every launch in an extra account: repairs a missing link, copies the synced files and the user's
   * MCP servers from the primary. Never touches anything else in the account's `.claude.json` (its login,
   * the trusted folders).
   */
  async prepareForLaunch(id: string): Promise<void> {
    const dir = this.extraDir(id);
    await this.guard(async () => {
      for (const name of SHARED_DIRS) await this.ensureLink(name, dir);
      for (const name of SYNCED_FILES) await this.syncFile(name, dir);
      await this.syncMcpServers(id);
    });
  }

  /** Logged in = `.credentials.json` and `oauthAccount` in `.claude.json`. Never reads or returns a token. */
  async loginState(id: AccountId): Promise<LoginState> {
    const credentials = await lstat(join(this.dirOf(id), '.credentials.json')).then(
      (stat) => stat.isFile(),
      () => false,
    );
    let email: string | null = null;
    try {
      const oauth = (await readJsonObject(this.claudeJsonOf(id)))?.oauthAccount as { emailAddress?: unknown } | undefined;
      if (typeof oauth?.emailAddress === 'string') email = oauth.emailAddress;
    } catch {
      // An unreadable .claude.json reads as logged out; claude rewrites it on its next start.
    }
    return { loggedIn: credentials && email !== null, email };
  }

  /**
   * Deletes an extra account's folder and its login. First checks that every shared entry is a link and that
   * no other link hides deeper in the folder — anything else aborts with ACCOUNT_005 before deleting a byte.
   * Then unlinks, and only then removes the folder.
   */
  async remove(id: AccountId): Promise<void> {
    if (id === 'primary') throw new AppError('ACCOUNT_003');
    const dir = this.extraDir(id);
    const exists = await lstat(dir).then(
      () => true,
      (error: unknown) => {
        if (isMissing(error)) return false;
        throw error;
      },
    );
    if (!exists) return;

    const links: string[] = [];
    for (const name of SHARED_DIRS) {
      const path = join(dir, name);
      const stat = await lstat(path).catch((error: unknown) => (isMissing(error) ? null : Promise.reject(error)));
      if (!stat) continue;
      if (!stat.isSymbolicLink()) throw new AppError('ACCOUNT_005', `${name} in the account folder is a real folder, not a link`);
      links.push(path);
    }
    const stray = await this.findLinks(dir, new Set(links));
    if (stray.length > 0) throw new AppError('ACCOUNT_005', `unexpected link in the account folder: ${stray[0]}`);

    await this.guard(async () => {
      for (const path of links) await unlink(path);
      await rm(dir, { recursive: true, force: true, maxRetries: 3 });
    });
  }

  private extraDir(id: string): string {
    if (id === 'primary') throw new AppError('ACCOUNT_005', 'the primary account has no folder of ours');
    return this.dirOf(id);
  }

  private async ensureLink(name: string, dir: string): Promise<void> {
    const target = join(this.options.primaryDir, name);
    await mkdir(target, { recursive: true });
    const path = join(dir, name);
    const stat = await lstat(path).catch((error: unknown) => (isMissing(error) ? null : Promise.reject(error)));
    if (stat?.isSymbolicLink()) return;
    if (stat) throw new AppError('ACCOUNT_005', `${name} in the account folder is a real folder, not a link`);
    // 'junction' needs no privileges on Windows; elsewhere the type is ignored and it is a plain symlink.
    await symlink(target, path, 'junction');
  }

  private async syncFile(name: string, dir: string): Promise<void> {
    const source = join(this.options.primaryDir, name);
    const copy = join(dir, name);
    try {
      await copyFile(source, copy);
    } catch (error) {
      if (!isMissing(error)) throw error;
      // The primary no longer has it: neither does the account.
      await rm(copy, { force: true });
    }
  }

  /** The `claude mcp add -s user` servers live in the `mcpServers` key of `.claude.json`, separate per account. */
  private async syncMcpServers(id: string): Promise<void> {
    const servers = (await readJsonObject(this.options.primaryClaudeJson))?.mcpServers;
    const path = this.claudeJsonOf(id);
    // Unreadable → throws (ACCOUNT_005): overwriting it would lose the account's login.
    const current = (await readJsonObject(path)) ?? {};
    const next = { ...current };
    if (servers === undefined) delete next.mcpServers;
    else next.mcpServers = servers;
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    await atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
  }

  /**
   * Every link (symlink or junction) under `dir`, never following one. `lstat` per entry, not the `Dirent`
   * type: `lstat` is what the spike proved reports a Windows junction as a link.
   */
  private async findLinks(dir: string, known: Set<string>): Promise<string[]> {
    const found: string[] = [];
    for (const name of await readdir(dir)) {
      const path = join(dir, name);
      if (known.has(path)) continue;
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) found.push(path);
      else if (stat.isDirectory()) found.push(...(await this.findLinks(path, known)));
    }
    return found;
  }

  /** Any filesystem failure while preparing or cleaning becomes ACCOUNT_005; our own errors pass through. */
  private async guard(work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('ACCOUNT_005', (error as Error).message);
    }
  }
}
