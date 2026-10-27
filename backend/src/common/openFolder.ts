import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';

/**
 * Shows a folder in the Windows Explorer (Preparar anexos, ADR 0025): `explorer.exe` with one fixed argument, the
 * folder the backend itself made — never a path from a request. No shell. Detached: the window outlives nothing of
 * ours. false when it cannot even start (not Windows, not absolute); the Explorer's own exit code means nothing (it
 * exits 1 on success), so a start is a success.
 */
export function openInExplorer(folder: string): boolean {
  if (process.platform !== 'win32' || !isAbsolute(folder)) return false;
  try {
    const child = spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore', windowsHide: false });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
