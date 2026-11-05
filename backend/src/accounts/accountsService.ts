import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors.js';
import { type AccountId, MAX_EXTRA_ACCOUNTS } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import type { TerminalView } from '../terminals/terminalsService.js';
import { readUsage } from '../usage/usageFiles.js';
import type { AccountDirs } from './accountDirs.js';
import type { AccountView, AccountsView } from './accounts.schemas.js';

/** What the accounts need from the terminals — bound late: the terminals need the accounts too. */
export type AccountTerminals = {
  runningCount(accountId: AccountId): number;
  createLogin(request: { accountId: AccountId; cwd: string; label: string; cols: number; rows: number }): Promise<TerminalView>;
  closeLogins(accountId: AccountId): Promise<void>;
};

export type AccountsServiceDeps = {
  stateStore: StateStore;
  dirs: AccountDirs;
  /** Where the per-account quota files are (usage/usageFiles.ts). */
  dataDir?: string;
  /** DEFAULT_CWD: where a login terminal opens. */
  defaultCwd?: string;
  terminals?: () => AccountTerminals;
};

const PRIMARY_LABEL = 'Principal';

/**
 * The Claude accounts (ADR 0027): which one is active, what a launch in each needs, and adding, naming and
 * removing them. The terminals ask it for the account of every `claude` they start — nothing else decides a
 * CLAUDE_CONFIG_DIR.
 */
export class AccountsService {
  constructor(private readonly deps: AccountsServiceDeps) {}

  /** A stored id (a terminal's, the active one) that no longer exists reads as the primary — never an error. */
  resolve(id: AccountId): AccountId {
    if (id === 'primary') return id;
    return this.deps.stateStore.read().accounts.some((account) => account.id === id) ? id : 'primary';
  }

  activeAccountId(): AccountId {
    return this.resolve(this.deps.stateStore.read().activeAccountId);
  }

  /** An id that comes in a request must exist: ACCOUNT_001 otherwise. */
  require(id: AccountId): AccountId {
    if (this.resolve(id) !== id) throw new AppError('ACCOUNT_001');
    return id;
  }

  /**
   * Gets an account ready for a `claude` to start in it and returns its CLAUDE_CONFIG_DIR — `undefined` for the
   * primary, whose launch is unchanged. An extra account gets its links repaired and the primary's settings,
   * CLAUDE.md, keybindings and MCP servers copied first.
   */
  async prepareLaunch(id: AccountId): Promise<string | undefined> {
    if (id === 'primary') return undefined;
    await this.deps.dirs.prepareForLaunch(id);
    return this.deps.dirs.configDirFor(id);
  }

  /** The primary first, then the extra ones by creation. */
  async list(): Promise<AccountsView> {
    const state = this.deps.stateStore.read();
    const ids: AccountId[] = ['primary', ...[...state.accounts].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((a) => a.id)];
    return { activeAccountId: this.activeAccountId(), accounts: await Promise.all(ids.map((id) => this.view(id))) };
  }

  async create(label: string): Promise<AccountView> {
    if (this.deps.stateStore.read().accounts.length >= MAX_EXTRA_ACCOUNTS) throw new AppError('ACCOUNT_002');
    const id = randomUUID();
    try {
      await this.deps.dirs.create(id);
    } catch (error) {
      // A half-made folder never stays behind (remove only deletes once every link is gone).
      await this.deps.dirs.remove(id).catch(() => {});
      throw error;
    }
    this.deps.stateStore.update((draft) => void draft.accounts.push({ id, label, createdAt: new Date().toISOString() }));
    return this.view(id);
  }

  async rename(id: AccountId, label: string): Promise<AccountView> {
    this.require(id);
    this.deps.stateStore.update((draft) => {
      if (id === 'primary') draft.primaryAccountLabel = label;
      else {
        const account = draft.accounts.find((a) => a.id === id);
        if (account) account.label = label;
      }
    });
    return this.view(id);
  }

  async setActive(id: AccountId): Promise<AccountsView> {
    this.require(id);
    this.deps.stateStore.update((draft) => void (draft.activeAccountId = id));
    return this.list();
  }

  /**
   * Deletes an extra account's folder and its login — the links to the primary first (AccountDirs.remove).
   * Refused while one of its terminals runs. Its saved and closed terminals move to the primary: the
   * conversations are shared, so they reopen there.
   */
  async remove(id: AccountId): Promise<void> {
    if (id === 'primary') throw new AppError('ACCOUNT_003');
    this.require(id);
    if ((this.deps.terminals?.().runningCount(id) ?? 0) > 0) throw new AppError('ACCOUNT_004');
    await this.deps.terminals?.().closeLogins(id);
    await this.deps.dirs.remove(id);
    this.deps.stateStore.update((draft) => {
      draft.accounts = draft.accounts.filter((account) => account.id !== id);
      for (const terminal of [...draft.terminals, ...draft.closedTerminals]) if (terminal.accountId === id) terminal.accountId = 'primary';
      if (draft.activeAccountId === id) draft.activeAccountId = 'primary';
    });
  }

  /** A login terminal in that account (ADR 0027): the owner logs in once, then answers the first-run dialogs. */
  async openLogin(id: AccountId, size: { cols: number; rows: number }): Promise<TerminalView> {
    this.require(id);
    const terminals = this.deps.terminals?.();
    if (!terminals || this.deps.defaultCwd === undefined) throw new Error('openLogin needs terminals and defaultCwd');
    return terminals.createLogin({ accountId: id, cwd: this.deps.defaultCwd, label: `Login — ${this.labelOf(id)}`, ...size });
  }

  private labelOf(id: AccountId): string {
    const state = this.deps.stateStore.read();
    if (id === 'primary') return state.primaryAccountLabel ?? PRIMARY_LABEL;
    return state.accounts.find((account) => account.id === id)?.label ?? PRIMARY_LABEL;
  }

  private async view(id: AccountId): Promise<AccountView> {
    const { loggedIn, email } = await this.deps.dirs.loginState(id);
    return {
      id,
      label: this.labelOf(id),
      isPrimary: id === 'primary',
      email,
      loggedIn,
      runningTerminals: this.deps.terminals?.().runningCount(id) ?? 0,
      usage: this.deps.dataDir === undefined ? { fiveHour: null, weekly: null, fetchedAt: null } : readUsage(this.deps.dataDir, id),
    };
  }
}
