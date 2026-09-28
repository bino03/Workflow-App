import { describe, expect, it } from 'vitest';
import { ClaudeArgsError, claudeArgs } from '../src/terminals/claudeArgs.js';

const ID = '118f54da-b4c4-4c0b-9491-d5e3077ff882';
const SETTINGS = 'C:\\Users\\me\\.workflow-app\\claude-settings.json';

describe('claudeArgs', () => {
  it('a new terminal passes the UUID the backend chose', () => {
    expect(claudeArgs({ kind: 'new', sessionId: ID })).toEqual(['--session-id', ID]);
  });

  it('resuming passes --resume with the UUID', () => {
    expect(claudeArgs({ kind: 'resume', sessionId: ID })).toEqual(['--resume', ID]);
  });

  it('adds --settings only when the backend gives an absolute path', () => {
    expect(claudeArgs({ kind: 'new', sessionId: ID }, { settingsPath: SETTINGS })).toEqual(['--session-id', ID, '--settings', SETTINGS]);
    expect(() => claudeArgs({ kind: 'new', sessionId: ID }, { settingsPath: 'claude-settings.json' })).toThrow(ClaudeArgsError);
  });

  it('refuses anything that is not a UUID — no text becomes a flag or a command', () => {
    for (const sessionId of [
      `${ID}; rm -rf /`,
      `${ID} --dangerously-skip-permissions`,
      '--dangerously-skip-permissions',
      `"${ID}"`,
      ` ${ID}`,
      '../../etc/passwd',
      '',
    ]) {
      expect(() => claudeArgs({ kind: 'resume', sessionId })).toThrow(ClaudeArgsError);
      expect(() => claudeArgs({ kind: 'new', sessionId })).toThrow(ClaudeArgsError);
    }
  });
});
