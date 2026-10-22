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

  it('adds --remote-control last, with or without a name (ADR 0017)', () => {
    expect(claudeArgs({ kind: 'new', sessionId: ID }, { remoteControl: {} })).toEqual(['--session-id', ID, '--remote-control']);
    expect(claudeArgs({ kind: 'resume', sessionId: ID }, { settingsPath: SETTINGS, remoteControl: { name: 'WorkFlow App · bot telegram' } })).toEqual([
      '--resume',
      ID,
      '--settings',
      SETTINGS,
      '--remote-control',
      'WorkFlow App · bot telegram',
    ]);
    expect(claudeArgs({ kind: 'new', sessionId: ID }, { remoteControl: { name: 'Gestão (v2) - ação_1.0' } }).at(-1)).toBe('Gestão (v2) - ação_1.0');
  });

  it('refuses a remote control name that could read as a flag or carry anything odd', () => {
    for (const name of [
      '',
      ' WorkFlow',
      '-x',
      '--dangerously-skip-permissions',
      'App "quoted"',
      'App $(whoami)',
      'App; rm -rf /',
      'App\nsecond line',
      'App\tTab',
      'App `x`',
      'a'.repeat(81),
    ]) {
      expect(() => claudeArgs({ kind: 'new', sessionId: ID }, { remoteControl: { name } })).toThrow(ClaudeArgsError);
    }
    expect(claudeArgs({ kind: 'new', sessionId: ID }, { remoteControl: { name: 'a'.repeat(80) } })).toHaveLength(4);
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
