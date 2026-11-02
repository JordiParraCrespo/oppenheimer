import type { WebSocket } from 'ws';

/**
 * Ping a socket every `intervalMs` and terminate it when the previous ping went
 * unanswered by the next one. A browser answers a ping on its own, so this costs
 * the console nothing; what it ends is a socket whose peer went away without a
 * close (a laptop lid, a phone leaving Wi-Fi, a NAT that forgot it), which
 * otherwise keeps its attachment and its re-check timer until a write times out.
 * Terminating fires `close`, which detaches the way a closed tab does.
 */
export function keepSocketAlive(ws: WebSocket, intervalMs: number): void {
  let answered = true;
  ws.on('pong', () => {
    answered = true;
  });
  const timer = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;
    if (!answered) {
      ws.terminate();
      return;
    }
    answered = false;
    ws.ping();
  }, intervalMs);
  timer.unref();
  ws.once('close', () => clearInterval(timer));
}
