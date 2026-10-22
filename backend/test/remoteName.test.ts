import { describe, expect, it } from 'vitest';
import { REMOTE_NAME } from '../src/terminals/claudeArgs.js';
import { remoteControlName } from '../src/terminals/remoteName.js';

const CWD = 'C:\\Users\\me\\projetos\\WorkFlow App';

describe('remoteControlName', () => {
  it('"<project folder> · <title>", or just the folder without a title', () => {
    expect(remoteControlName(CWD, 'Bot de Telegram')).toBe('WorkFlow App · Bot de Telegram');
    expect(remoteControlName(CWD, null)).toBe('WorkFlow App');
  });

  it('drops anything outside the allowlist and never starts with a dash', () => {
    expect(remoteControlName(CWD, 'Fix "login" $(rm) `x`\nnow')).toBe('WorkFlow App · Fix login (rm) x now');
    expect(remoteControlName('C:\\p\\--odd', 'title')).toBe('odd · title');
    expect(remoteControlName('C:\\p\\###', null)).toBeUndefined();
  });

  it('cuts at 80 characters and always passes REMOTE_NAME', () => {
    const name = remoteControlName(CWD, 'muito '.repeat(40))!;
    expect(name.length).toBeLessThanOrEqual(80);
    expect(REMOTE_NAME.test(name)).toBe(true);
  });
});
