import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * The one header Better Auth reads a client's address from. The API writes it
 * on every `/api/auth/*` request, overwriting whatever the client sent, so no
 * caller can choose its rate-limit bucket.
 *
 * Better Auth sees only a Web `Request`, never the socket, and by default keys
 * its rate limit on `X-Forwarded-For` as sent: a client that sends a new
 * address each time gets a new bucket, and unlimited password guesses with it.
 * Its own `trustedProxies` names proxies by address, not by count, so it
 * cannot say what `TRUST_PROXY` says. Express can: `main.ts` sets `trust
 * proxy` to that many hops, and `req.ip` is then the address the hop before
 * them saw, or the socket's own address when `TRUST_PROXY=0`. That is the same
 * address the API's other limiters and the token IP allowlists use.
 */
export const AUTH_CLIENT_IP_HEADER = 'x-oppenheimer-auth-client-ip';

/** `advanced.ipAddress` for `betterAuth(...)`: read the header above and nothing else. */
export const authIpAddressOptions: { ipAddressHeaders: string[] } = {
  ipAddressHeaders: [AUTH_CLIENT_IP_HEADER],
};

/** The request as Express hands it on: `ip` is set once `trust proxy` has been applied. */
type ExpressRequest = IncomingMessage & { ip?: string };

/**
 * Wrap the Better Auth route middleware so the client address header is set
 * from `req.ip` before the handler builds its `Request`. With no address (a
 * socket already gone) the header is removed, and Better Auth falls back to
 * its single shared bucket rather than trusting anything the client said.
 */
export function withAuthClientIp<Req extends ExpressRequest, Res extends ServerResponse>(
  next?: (req: Req, res: Res, handle: () => void) => unknown,
): (req: Req, res: Res, handle: () => void) => unknown {
  return (req, res, handle) => {
    const ip = req.ip ?? req.socket?.remoteAddress;
    if (ip) req.headers[AUTH_CLIENT_IP_HEADER] = ip;
    else delete req.headers[AUTH_CLIENT_IP_HEADER];
    return next ? next(req, res, handle) : handle();
  };
}
