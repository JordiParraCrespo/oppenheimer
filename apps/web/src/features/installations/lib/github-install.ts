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
 *
 * Where the browser *goes* to install is not here: the API serves it as
 * `github_app_install_url` on `GET /health/capabilities`, built from the slug
 * it already holds. The console keeps no copy.
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
