import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * Whether Claude Code already trusts a folder — read-only, never written. A `claude` launched for Remote
 * Control has nobody at the PTY to answer the trust dialog (ADR 0017), so those launches need a trusted folder.
 *
 * Where Claude Code keeps it (confirmed in the remote-control spike, 2026-10-22): `.claude.json` in the config
 * dir (`<CLAUDE_CONFIG_DIR>/.claude.json`, else `~/.claude.json`) → `projects["C:/…"].hasTrustDialogAccepted`.
 * A trusted parent counts (a subfolder is not written down on its own). Keys use `/`, and the same folder may
 * appear twice with only the drive letter's case changed (one of them `false`): any `true` wins.
 */
export function claudeJsonPath(claudeConfigDir: string | undefined): string {
  return claudeConfigDir ? join(claudeConfigDir, '.claude.json') : join(homedir(), '.claude.json');
}

const keyOf = (path: string) => {
  const slashed = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
};

/** The folder and each of its parents, as comparable keys. */
function selfAndParents(cwd: string): string[] {
  const keys: string[] = [];
  let current = resolve(cwd);
  for (;;) {
    keys.push(keyOf(current));
    const parent = dirname(current);
    if (parent === current) return keys;
    current = parent;
  }
}

export function trustedFolders(claudeJson: unknown): Set<string> {
  const trusted = new Set<string>();
  const projects = (claudeJson as { projects?: unknown } | null)?.projects;
  if (!projects || typeof projects !== 'object') return trusted;
  for (const [path, entry] of Object.entries(projects)) {
    if ((entry as { hasTrustDialogAccepted?: unknown } | null)?.hasTrustDialogAccepted === true) trusted.add(keyOf(path));
  }
  return trusted;
}

/** Never throws: a missing or unreadable file means "not trusted". */
export async function isTrustedFolder(cwd: string, claudeConfigDir: string | undefined): Promise<boolean> {
  let trusted: Set<string>;
  try {
    trusted = trustedFolders(JSON.parse(await readFile(claudeJsonPath(claudeConfigDir), 'utf8')));
  } catch {
    return false;
  }
  return selfAndParents(cwd).some((key) => trusted.has(key));
}
