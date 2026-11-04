import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  fixtureController,
  scanFixture,
  scanRoutes,
  sourceFiles,
  withoutComments,
} from './route-scopes';

/**
 * Every way into the API is authenticated, or written down as not.
 *
 * Authentication is per controller (`@UseGuards(ApiAuthGuard, …)`), not global,
 * so a controller that forgets the decorator is open to anyone, and nothing at
 * run time says so: `ScopesGuard` passes a request with no credential, and
 * `@NoPolicy` waives the one guard that would have asked for a principal. So
 * every route either runs an authenticating guard or is in `PUBLIC` with the
 * reason it may not; the ledger and the source are checked both ways, and an
 * entry is a change a reviewer reads.
 *
 * The sockets are not routes: they are `upgrade` listeners on a Node server,
 * which no guard sees. Each place that accepts one is in `UPGRADES`, with how
 * it authenticates and the call that does it, which must still be in the file.
 * The handshakes themselves are proven by `relay/__tests__/relay.gateways.spec.ts`
 * and `relay/__tests__/preview-proxy.spec.ts`.
 *
 * The scan is `route-scopes.ts`, which fails closed (`route-scope-coverage.spec.ts`
 * asserts it read everything).
 */

const SRC = resolve(__dirname, '..');

/**
 * Guards that refuse a request with no credential. `OptionalApiAuthGuard`
 * is not one: it forgives an absent credential by design, so its routes are
 * in `PUBLIC` like any other route an anonymous caller reaches.
 */
const AUTHENTICATING = new Set(['ApiAuthGuard', 'HostPrincipalGuard']);

/** Routes an anonymous caller reaches, and what stands in for a signed-in caller. */
const PUBLIC: Record<string, string> = {
  'GET /v1/health': 'liveness probe; the container healthcheck calls it with no credential',
  'GET /v1/ready': 'readiness probe; the deploy gate calls it with no credential',
  'GET /v1/health/capabilities':
    'what the login page needs to draw itself, read before anyone is signed in',
  'GET /v1/metrics': 'the Prometheus scrape; METRICS_TOKEN over HTTP Basic, else a 404',
  'GET /v1/cloud-files/:token':
    'a cloud agent with no account of ours; the unguessable, day-long token in the path admits it',
  'POST /v1/hosts/register':
    'a machine redeeming a registration token, the whole credential, which the handler checks',
  'POST /v1/github/webhook':
    'GitHub cannot send a bearer; the handler verifies the X-Hub-Signature-256 HMAC',
  'GET /v1/feature-flags':
    'OptionalApiAuthGuard: the signed-out console reads its flags before anyone signs in',
  'POST /v1/shared-sessions/lookup':
    'OptionalApiAuthGuard: the share judges the caller and answers a signed-out one SESSIONS_022',
  'POST /v1/shared-sessions/attach-ticket':
    'OptionalApiAuthGuard: the share judges the caller and answers a signed-out one SESSIONS_022',
};

/**
 * Every place the API accepts a socket, keyed by file: how the handshake is
 * authenticated, and the method whose call does it. The call must still be in
 * the file as code (`calls`), so the entry cannot outlive the check it
 * describes, while its arguments and the lines around it are free to change.
 */
const UPGRADES: Record<string, { how: string; calls: string }> = {
  'relay/infrastructure/relay-upgrade.gateway.ts': {
    how: "the API server's upgrade listener: hands the two socket paths to their gateways' handleUpgrade, refuses any other with a 404, authenticates nothing itself",
    calls: 'handleUpgrade',
  },
  'relay/infrastructure/runner-link.gateway.ts': {
    how: "a runner's boot assertion as the bearer, verified (its jti burned) before the upgrade is accepted",
    calls: 'verify',
  },
  'relay/infrastructure/browser-attach.gateway.ts': {
    how: 'an allowed Origin and a single-use attach ticket as the subprotocol, refused before the upgrade when absent; the ticket is redeemed and judged before any frame is handled, and again every minute',
    calls: 'redeem',
  },
  'relay/infrastructure/preview-proxy.gateway.ts': {
    how: "the previews' own server (PREVIEW_PORT, outside Nest): every request and upgrade needs the signed preview cookie a ticket redeemed for, judged as an attachment is, and again every minute",
    calls: 'reader',
  },
};

/**
 * Whether `source` calls a method named `method` (`.method(`), with comments
 * and string literals blanked so a mention in either is not a call.
 */
function callsMethod(source: string, method: string): boolean {
  const code = withoutComments(source).replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "''");
  return new RegExp(`\\.${method}\\s*\\(`).test(code);
}

/** Files that take sockets: an `upgrade` listener, a `ws` server, a Nest gateway. */
const SOCKET_ENTRY = /\.on\(\s*['"]upgrade['"]|new WebSocketServer\(|@WebSocketGateway\(/;

const { routes } = scanRoutes();

describe('route authentication coverage', () => {
  it('finds the routes to check', () => {
    // A scan that silently matched nothing would pass every assertion below.
    expect(routes.length).toBeGreaterThan(150);
  });

  it('authenticates every route, unless the ledger says why not', () => {
    const open = routes
      .filter((route) => !route.guards.some((guard) => AUTHENTICATING.has(guard)))
      .map((route) => route.route);

    expect(open.sort()).toEqual(Object.keys(PUBLIC).sort());
  });

  it('gives every public route a non-trivial reason', () => {
    const weak = Object.entries(PUBLIC).filter(([, reason]) => reason.trim().length < 30);
    expect(weak).toEqual([]);
  });

  it('lists every place that accepts a socket, and only those', () => {
    const entries = sourceFiles()
      .filter((file) => SOCKET_ENTRY.test(withoutComments(readFileSync(file, 'utf8'))))
      .map((file) => relative(SRC, file));

    expect(entries.sort()).toEqual(Object.keys(UPGRADES).sort());
  });

  it('still finds the check each socket entry names in its file', () => {
    const missing = Object.entries(UPGRADES)
      .filter(([file, { calls }]) => !callsMethod(readFileSync(resolve(SRC, file), 'utf8'), calls))
      .map(([file, { calls }]) => `${file}: .${calls}(`);

    expect(missing).toEqual([]);
  });
});

describe('the socket check matcher', () => {
  it('finds a call whatever its receiver and arguments', () => {
    expect(callsMethod('await this.assertions.verify(bearer, { now });', 'verify')).toBe(true);
    expect(callsMethod('const ok = await gate.verify (token)', 'verify')).toBe(true);
  });

  it('does not take a comment, a string or another method for the call', () => {
    const source = [
      '// this.assertions.verify(bearer) used to run here',
      "log('then .verify(bearer)');",
      'this.assertions.verifyLater(bearer);',
    ].join('\n');

    expect(callsMethod(source, 'verify')).toBe(false);
  });
});

describe('the guard scan', () => {
  it('does not count a guard that only appears in a comment', () => {
    const { routes } = scanFixture({
      'things.http.controller.ts': fixtureController(
        "  @Get()\n  @NoPolicy('anything at all, for the fixture')\n  find() {}",
        "// @UseGuards(ApiAuthGuard)\n@Controller('things')",
      ),
    });

    expect(routes.map((route) => route.guards)).toEqual([[]]);
  });
});
