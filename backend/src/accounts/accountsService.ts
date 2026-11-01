import { AppError } from '../common/errors.js';
import type { AccountId } from '../state/state.schema.js';
import type { StateStore } from '../state/stateStore.js';
import type { AccountDirs } from './accountDirs.js';

export type AccountsServiceDeps = {
  stateStore: StateStore;
  dirs: AccountDirs;
};

/**
 * The Claude accounts (ADR 0027): which one is active, and what a launch in each needs. The terminals ask it
 * for the account of every `claude` they start — nothing else decides a CLAUDE_CONFIG_DIR.
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
}
