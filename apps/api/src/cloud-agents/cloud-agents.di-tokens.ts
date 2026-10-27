export const CLOUD_AGENT_CREDENTIAL_REPOSITORY = Symbol('CLOUD_AGENT_CREDENTIAL_REPOSITORY');
/** Seals a person's vendor key under `CLOUD_AGENTS_KEY` (`KeySealerPort`). */
export const KEY_SEALER = Symbol('KEY_SEALER');
/** Cursor's Cloud Agents API (`CursorCloudAgentsPort`). */
export const CURSOR_CLOUD_AGENTS = Symbol('CURSOR_CLOUD_AGENTS');
/** What a cloud session asks its vendor (`CloudRunsPort`), published for the sessions module. */
export const CLOUD_RUNS = Symbol('CLOUD_RUNS');
