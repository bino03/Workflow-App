import { basename } from 'node:path';
import { REMOTE_NAME } from './claudeArgs.js';

const MAX = 80;

/**
 * The name a Remote Control session gets in the Claude app: "<project folder> · <conversation title>"
 * (ADR 0017). Built only from what the backend reads (the cwd and the session's .jsonl), then squeezed into
 * REMOTE_NAME's allowlist. Undefined → no name, and Claude Code picks its automatic one.
 */
export function remoteControlName(cwd: string, title: string | null): string | undefined {
  const clean = (text: string) =>
    text
      .replace(/[^\p{L}\p{N} ._\-()·]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const project = clean(basename(cwd));
  const parts = [project, title ? clean(title) : ''].filter(Boolean);
  const name = parts.join(' · ').replace(/^[^\p{L}\p{N}]+/u, '').slice(0, MAX).trimEnd();
  return REMOTE_NAME.test(name) ? name : undefined;
}
