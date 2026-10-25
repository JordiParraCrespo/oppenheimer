import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const PAGE = join(ROOT, 'e2e/tests/terminal/page');
const fromWeb = createRequire(join(ROOT, 'apps/web/package.json'));

export interface TerminalPage {
  origin: string;
  close(): Promise<void>;
}

/** Serves this page, the console's session terminal on a fake host, from Vite. */
export async function serveTerminalPage(): Promise<TerminalPage> {
  const server = await createServer({
    root: PAGE,
    configFile: false,
    logLevel: 'error',
    server: { port: 0, host: '127.0.0.1', fs: { allow: [ROOT] } },
    resolve: {
      // The page imports the console's code, whose dependencies live in apps/web.
      alias: { '@xterm/xterm/css/xterm.css': fromWeb.resolve('@xterm/xterm/css/xterm.css') },
    },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

declare global {
  interface Window {
    harness: {
      host: { hold(): void; release(): void; print(text: string): void; echoes: number };
      renderer(): 'dom' | 'webgl';
      watchCursors(): void;
      stopWatching(): number[];
      screen(): { x: number; y: number; width: number; height: number };
    };
  }
}
