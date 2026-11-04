/**
 * What `GET /health/version` answers: the API's release, the `version` of its
 * `package.json` as Changesets last set it. The console shows it beside its own
 * in Settings → About, so a reader can tell which build each side runs.
 */
export interface ApiVersion {
  version: string;
}
