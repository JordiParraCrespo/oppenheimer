// A stand-in for the runner's local socket (`apps/runner/internal/cli/local_attach.go`),
// the same routes on a 0600 Unix socket, so both shells' bridges are measured
// against the same peer with no tmux in the way: `GET /v1/sessions/{id}` and
// `GET /v1/sessions/{id}/attach` (binary frames both ways, text frames a resize).
// The attachment echoes what it is sent, as a shell with echo on does; the byte
// 0x06 makes it print FLOOD_BYTES instead, in 16 KiB frames, waiting for each
// frame to be written (the stall the shell's credit window causes upstream).
import { chmodSync, mkdirSync, rmSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(join(process.env.WS_FROM ?? process.cwd(), 'package.json'));
const { WebSocketServer } = require('ws');

const SOCKET = join(process.env.RUNNER_HOME, 'run', 'runner.sock');
const FLOOD_BYTES = Number(process.env.FLOOD_BYTES ?? 21 * 1024 * 1024);
const FRAME = 16 * 1024;

mkdirSync(dirname(SOCKET), { recursive: true, mode: 0o700 });
rmSync(SOCKET, { force: true });

const server = http.createServer((req, res) => {
  const m = /^\/v1\/sessions\/([^/?]+)$/.exec(req.url ?? '');
  if (req.method === 'GET' && m) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: decodeURIComponent(m[1]), window: 0 }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
server.on('upgrade', (req, socket, head) => {
  if (!/^\/v1\/sessions\/[^/?]+\/attach/.test(req.url ?? '')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    socket.setNoDelay?.(true);
    // STUB_GREETING=1: say which window attached, before any input, as a
    // shell's prompt arrives before the first key.
    if (process.env.STUB_GREETING) {
      const window = new URL(req.url, 'http://runner').searchParams.get('window');
      ws.send(Buffer.from(`attached:${window}`), { binary: true });
    }
    ws.on('message', async (data, isBinary) => {
      if (!isBinary) return; // a resize
      if (data.length === 1 && data[0] === 0x06) {
        const frame = Buffer.alloc(FRAME, 0x61);
        for (let i = 0; i < FRAME; i += 80) frame[i] = 0x0a;
        for (let sent = 0; sent < FLOOD_BYTES; sent += FRAME) {
          await new Promise((resolve, reject) =>
            ws.send(
              frame.subarray(0, Math.min(FRAME, FLOOD_BYTES - sent)),
              { binary: true },
              (e) => (e ? reject(e) : resolve()),
            ),
          );
        }
        return;
      }
      ws.send(data, { binary: true });
    });
  });
});

server.listen(SOCKET, () => {
  chmodSync(SOCKET, 0o600);
  console.log(`stub runner on ${SOCKET}`);
});
