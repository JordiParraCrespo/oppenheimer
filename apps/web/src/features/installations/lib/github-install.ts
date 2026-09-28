/** What GitHub appends to the callback once someone has installed the App. */
export interface GithubInstallCallback {
  /** GitHub's own installation id, for the connect body. */
  installation_id?: number;
  /** The one-shot OAuth code that proves the caller can see that installation. */
  code?: string;
  /** `install` or `update`; GitHub sends it on both paths. */
  setup_action?: string;
  /**
   * The install state the API minted, **nonce only**: the route strips the
   * walk's prefix before this reads it, so what the connect call posts is
   * exactly what was minted. Absent when the redirect carried none, or one
   * this console never sends.
   */
  state?: string;
}

/** The API's nonce: base64url, 16–128 characters, so never a `.`. */
const STATE_NONCE = /^[A-Za-z0-9_-]{16,128}$/;

/**
 * Read the callback off a router search object.
 *
 * `installation_id` arrives as a string in the URL and is a number on the
 * wire, so it is parsed here rather than at the call site — a `NaN` reaching
 * the API would be a 400 the screen could not explain.
 *
 * `state` is what GitHub echoed, with any walk prefix already off. Anything
 * that is not a nonce — junk, a forwarded link with none — becomes
 * `undefined`, and the step then refuses to post rather than letting the API
 * say so.
 */
export function parseInstallCallback(search: Record<string, unknown>): GithubInstallCallback {
  const rawId = search.installation_id;
  const id = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : Number(rawId);

  return {
    installation_id: Number.isFinite(id) && id > 0 ? id : undefined,
    code: typeof search.code === 'string' && search.code ? search.code : undefined,
    setup_action: typeof search.setup_action === 'string' ? search.setup_action : undefined,
    state: parseStateNonce(search.state),
  };
}

function parseStateNonce(raw: unknown): string | undefined {
  return typeof raw === 'string' && STATE_NONCE.test(raw) ? raw : undefined;
}
