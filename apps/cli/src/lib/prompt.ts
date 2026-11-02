import { createInterface } from 'node:readline';
import { CliError, ExitCode } from './errors';

/** Ask a question on the terminal. Fails clearly when there is no terminal. */
export async function ask(question: string): Promise<string> {
  requireTty(question);

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await new Promise<string>((resolve) => rl.question(question, resolve))).trim();
  } finally {
    rl.close();
  }
}

/** Ask for a secret, echoing nothing. */
export async function askSecret(question: string): Promise<string> {
  requireTty(question);

  process.stderr.write(question);
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;

  stdin.setRawMode?.(true);
  stdin.resume();

  try {
    const secret = await new Promise<string>((resolve, reject) => {
      // Bytes, not characters. `String.fromCharCode` per byte mangles anything
      // outside ASCII — the two UTF-8 bytes of `é` become `Ã©` — so the typed
      // passphrase and the stored one stop matching. The control keys below
      // are all < 0x80, and no UTF-8 continuation byte is, so they stay
      // unambiguous while the rest is decoded as a whole at the end.
      const bytes: number[] = [];

      const onData = (chunk: Buffer) => {
        for (const byte of chunk) {
          switch (byte) {
            case 0x03: // Ctrl-C
              cleanup();
              reject(new CliError('Cancelled.', ExitCode.USAGE));
              return;
            case 0x0d: // Enter
            case 0x0a:
              cleanup();
              resolve(Buffer.from(bytes).toString('utf8'));
              return;
            case 0x7f: // Backspace
            case 0x08:
              // Drop one character: its continuation bytes, then its lead.
              while (bytes.length && (bytes[bytes.length - 1] & 0xc0) === 0x80) bytes.pop();
              bytes.pop();
              break;
            default:
              bytes.push(byte);
          }
        }
      };

      const cleanup = () => {
        stdin.off('data', onData);
        process.stderr.write('\n');
      };

      stdin.on('data', onData);
    });

    return secret;
  } finally {
    stdin.setRawMode?.(wasRaw ?? false);
    stdin.pause();
  }
}

/** Ask for confirmation. Returns false unless the answer starts with `y`. */
export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} [y/N] `);
  return /^y(es)?$/i.test(answer);
}

function requireTty(question: string): void {
  if (!process.stdin.isTTY) {
    throw new CliError(
      `Cannot prompt for "${question.trim()}" — this is not an interactive terminal.`,
      ExitCode.USAGE,
      'Pass the value as a flag, or set the matching environment variable.',
    );
  }
}
