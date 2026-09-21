/**
 * Where "Connect GitHub" sends the browser, and what comes back.
 *
 * The App's slug is read from `VITE_GITHUB_APP_SLUG` because no endpoint
 * serves it yet; the server keeps its own copy in `GITHUB_APP_SLUG`. That is a
 * second source of truth and it is temporary — when the API serves the install
 * link, this file is the one place that changes.
 */
const APP_SLUG = import.meta.env.VITE_GITHUB_APP_SLUG as string | undefined;

/**
 * The install page for this deployment's App, or `undefined` when no slug is
 * configured. Undefined is rendered as a disabled button rather than a link to
 * `github.com/apps/undefined`, which is a 404 dressed up as an offer.
 */
export function githubInstallUrl(): string | undefined {
  if (!APP_SLUG) return undefined;
  return `https://github.com/apps/${APP_SLUG}/installations/new`;
}

/** What GitHub appends to the callback once someone has installed the App. */
export interface GithubInstallCallback {
  /** GitHub's own installation id, for the connect body. */
  installation_id?: number;
  /** The one-shot OAuth code that proves the caller can see that installation. */
  code?: string;
  /** `install` or `update`; GitHub sends it on both paths. */
  setup_action?: string;
}

/**
 * Read the callback off a router search object.
 *
 * `installation_id` arrives as a string in the URL and is a number on the
 * wire, so it is parsed here rather than at the call site — a `NaN` reaching
 * the API would be a 400 the screen could not explain.
 */
export function parseInstallCallback(search: Record<string, unknown>): GithubInstallCallback {
  const rawId = search.installation_id;
  const id = typeof rawId === 'string' ? Number.parseInt(rawId, 10) : Number(rawId);

  return {
    installation_id: Number.isFinite(id) && id > 0 ? id : undefined,
    code: typeof search.code === 'string' && search.code ? search.code : undefined,
    setup_action: typeof search.setup_action === 'string' ? search.setup_action : undefined,
  };
}
