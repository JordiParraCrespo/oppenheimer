import { type AuthSession, toAuthSession } from './session';

/**
 * The global an app's `public/session-preload.js` writes.
 *
 * That script runs in `<head>`, before the app bundle has been fetched, let
 * alone parsed — so the session lookup overlaps bundle parse instead of
 * starting after React has mounted. It resolves to the endpoint's JSON body,
 * to `null` when nobody is signed in, or to `undefined` when the request was
 * not usable (offline, a proxy error, an HTML error page), which means "ask the
 * auth client properly".
 */
declare global {
  interface Window {
    __OPPENHEIMER_SESSION_PRELOAD__?: Promise<unknown>;
  }
}

/** The slice of a Better Auth `get-session` body this reads. */
interface PreloadedSessionBody {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
  };
}

function isSessionBody(value: unknown): value is PreloadedSessionBody {
  if (typeof value !== 'object' || value === null) return false;
  const { user } = value as { user?: unknown };
  if (typeof user !== 'object' || user === null) return false;
  const { id, email } = user as { id?: unknown; email?: unknown };
  return typeof id === 'string' && typeof email === 'string';
}

/**
 * Takes the preloaded session, if there is one to take.
 *
 * Returns the session, `null` for a confirmed anonymous visitor, or `undefined`
 * when there is nothing usable and the caller should go through the auth client
 * as before. Anything unrecognised is treated as `undefined` rather than as
 * "signed out": mistaking a bad response for no session signs a reader out on a
 * blip, which is exactly the failure `restoreSession()`'s retries exist to
 * avoid.
 *
 * One-shot. The global is cleared before the body is read, so a later call —
 * after a sign-in, or a refetch — always goes to the auth client, which owns
 * the session's lifetime. A preloaded answer is only ever the first answer.
 */
export async function consumeSessionPreload(): Promise<AuthSession | null | undefined> {
  if (typeof window === 'undefined') return undefined;

  const pending = window.__OPPENHEIMER_SESSION_PRELOAD__;
  if (!pending) return undefined;
  window.__OPPENHEIMER_SESSION_PRELOAD__ = undefined;

  const body = await pending.catch(() => undefined);
  if (body === null) return null;
  if (!isSessionBody(body)) return undefined;

  return toAuthSession({ data: body, error: null });
}
