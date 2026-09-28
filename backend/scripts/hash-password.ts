/**
 * Prints an argon2id hash for APP_PASSWORD_HASH. The password is read from the terminal without
 * echo (asked twice), or from stdin when piped. Only the hash goes to stdout.
 *
 *   npm run hash-password
 */
import argon2 from 'argon2';

const MIN_LENGTH = 12;

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          reject(new Error('cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function readPiped(): Promise<string> {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input.replace(/\r?\n$/, '');
}

async function main() {
  let password: string;
  if (process.stdin.isTTY) {
    password = await readHidden('Password: ');
    const again = await readHidden('Repeat: ');
    if (password !== again) throw new Error('passwords do not match');
  } else {
    password = await readPiped();
  }
  if (password.length < MIN_LENGTH) throw new Error(`password must have at least ${MIN_LENGTH} characters`);

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  process.stderr.write('\nAPP_PASSWORD_HASH for backend/.env:\n');
  process.stdout.write(`${hash}\n`);
}

main().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
