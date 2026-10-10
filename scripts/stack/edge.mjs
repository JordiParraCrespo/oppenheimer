#!/usr/bin/env node
/**
 * The stack's edge: a TCP proxy that holds every byte for half a round trip
 * each way, standing where Cloudflare and the tunnel stand in front of a real
 * deployment.
 *
 *   node scripts/stack/edge.mjs <listen port> <upstream port> <round trip ms>
 *
 * On the dev deployment a browser in Madrid reaches the API in Falkenstein
 * through Cloudflare's edge and a tunnel, and so does a runner on a laptop:
 * about 60 ms a round trip each (measured from a host in Spain, October
 * 2026). A keystroke pays it twice — browser to relay, relay to runner — and
 * its echo twice more on the way back. Locally both legs are loopback and
 * typing feels instant, so lag that every real user sees never shows up here.
 *
 * It is TCP, not HTTP: WebSocket frames, the runner's link and plain requests
 * are all delayed alike, and nothing is parsed or rewritten. Order is kept per
 * direction, and a connection's end is delayed like its bytes, so a close
 * never overtakes data still in flight.
 */
import { connect, createServer } from 'node:net';

const [listenPort, upstreamPort, roundTrip] = process.argv.slice(2).map(Number);
if (!listenPort || !upstreamPort || !Number.isFinite(roundTrip) || roundTrip < 0) {
  console.error('usage: edge.mjs <listen port> <upstream port> <round trip ms>');
  process.exit(2);
}
const oneWay = roundTrip / 2;

/**
 * Copies `from` into `to` `oneWay` ms late. Every chunk waits the same time,
 * so timers fire in arrival order; reading pauses while `to` is backed up, so
 * a slow reader is felt upstream as it would be across a real network.
 */
function delayed(from, to) {
  from.on('data', (chunk) => {
    setTimeout(() => {
      if (!to.destroyed && !to.write(chunk)) {
        from.pause();
        to.once('drain', () => from.resume());
      }
    }, oneWay);
  });
  from.on('end', () => setTimeout(() => to.end(), oneWay));
  from.on('error', () => setTimeout(() => to.destroy(), oneWay));
  from.on('close', () => setTimeout(() => to.destroy(), oneWay + 1));
}

const server = createServer((client) => {
  client.setNoDelay(true);
  const upstream = connect({ port: upstreamPort, host: '127.0.0.1' });
  upstream.setNoDelay(true);
  delayed(client, upstream);
  delayed(upstream, client);
});

server.listen(listenPort, () => {
  console.log(`edge: :${listenPort} -> :${upstreamPort}, ${roundTrip} ms round trip`);
});
