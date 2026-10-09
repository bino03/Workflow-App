import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { PasskeyFileError, PasskeyStore } from './auth/passkeyStore.js';
import { type Config, ConfigError, loadConfig } from './config.js';
import { StateFileError, StateStore } from './state/stateStore.js';
import { ClaudeBinError, type SpawnPty, claudeSpawner, resolveClaudeBin } from './terminals/spawnClaude.js';
import { TerminalManager } from './terminals/terminalManager.js';

// backend/.env — same relative path from src/ (tsx) and dist/ (node).
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

let config: Config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

let stateStore: StateStore;
try {
  stateStore = await StateStore.load(config.dataDir);
} catch (error) {
  if (error instanceof StateFileError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

let passkeyStore: PasskeyStore;
try {
  passkeyStore = await PasskeyStore.load(config.dataDir);
} catch (error) {
  if (error instanceof PasskeyFileError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

// A missing `claude` must not stop the rest of the app (library, sessions) — terminals fail on create.
let claudeBinError: string | undefined;
let spawn: SpawnPty = () => {
  throw new ClaudeBinError(claudeBinError);
};
try {
  spawn = claudeSpawner(resolveClaudeBin(config.terminals.claudeBin));
} catch (error) {
  if (!(error instanceof ClaudeBinError)) throw error;
  claudeBinError = error.message;
}

const terminalManager = new TerminalManager({
  spawn,
  maxTerminals: config.terminals.maxTerminals,
  scrollbackBytes: config.terminals.scrollbackBytes,
});
const app = await buildApp({ config, terminalManager, stateStore, passkeyStore });
if (claudeBinError) app.log.warn(claudeBinError);

const SHUTDOWN_TIMEOUT_MS = 5000;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  // Killed PTYs leave ConPTY handles alive, so the process never exits on its own.
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) {
  process.on(signal, () => void shutdown(signal));
}

await app.listen({ host: config.host, port: config.port });
