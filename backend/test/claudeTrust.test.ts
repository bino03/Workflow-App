import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { claudeJsonPath, isTrustedFolder } from '../src/sessions/claudeTrust.js';

const configDir = mkdtempSync(join(tmpdir(), 'wfa-trust-'));
afterAll(() => rmSync(configDir, { recursive: true, force: true }));

const slash = (path: string) => path.replace(/\\/g, '/');
const trustedRoot = join(configDir, 'projetos', 'WorkFlow App');
const untrusted = join(configDir, 'projetos', 'Outro');
const lowerOnly = join(configDir, 'projetos', 'BizManager');
mkdirSync(join(trustedRoot, 'backend'), { recursive: true });

function writeClaudeJson(projects: Record<string, unknown>) {
  writeFileSync(claudeJsonPath(configDir), JSON.stringify({ numStartups: 3, projects }));
}

describe('isTrustedFolder', () => {
  it('reads <CLAUDE_CONFIG_DIR>/.claude.json, else ~/.claude.json', () => {
    expect(claudeJsonPath(configDir)).toBe(join(configDir, '.claude.json'));
    expect(claudeJsonPath(undefined)).toMatch(/[\\/]\.claude\.json$/);
  });

  it('a trusted folder, and any folder under it, is trusted; others are not', async () => {
    writeClaudeJson({
      [slash(trustedRoot)]: { hasTrustDialogAccepted: true },
      [slash(untrusted)]: { hasTrustDialogAccepted: false },
    });
    expect(await isTrustedFolder(trustedRoot, configDir)).toBe(true);
    expect(await isTrustedFolder(join(trustedRoot, 'backend'), configDir)).toBe(true);
    expect(await isTrustedFolder(untrusted, configDir)).toBe(false);
    expect(await isTrustedFolder(join(configDir, 'projetos'), configDir)).toBe(false); // a parent of a trusted one is not
  });

  it.runIf(process.platform === 'win32')('Windows: any entry differing only in case counts, and a false twin does not win', async () => {
    const key = slash(lowerOnly);
    writeClaudeJson({
      [key.toLowerCase()]: { hasTrustDialogAccepted: false },
      [key.toUpperCase()]: { hasTrustDialogAccepted: true },
    });
    expect(await isTrustedFolder(lowerOnly, configDir)).toBe(true);
  });

  it('a missing, unreadable or odd file means not trusted — never throws', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'wfa-trust-empty-'));
    expect(await isTrustedFolder(trustedRoot, empty)).toBe(false);
    writeFileSync(claudeJsonPath(empty), '{ not json');
    expect(await isTrustedFolder(trustedRoot, empty)).toBe(false);
    writeFileSync(claudeJsonPath(empty), JSON.stringify({ projects: [1, 2] }));
    expect(await isTrustedFolder(trustedRoot, empty)).toBe(false);
    rmSync(empty, { recursive: true, force: true });
  });
});
