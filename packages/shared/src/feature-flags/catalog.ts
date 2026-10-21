import type { FlagDefinition, FlagValue } from './types.js';

/**
 * The feature-flag catalog — every flag the code may read, and the only place
 * one is declared.
 *
 * A key here is what `useFeatureFlag`, `FlagEvaluatorPort.isEnabled` and
 * `@RequireFlag` accept, so a typo is a compile error and deleting a flag
 * breaks every reader that still names it. The database holds only targeting
 * for these keys; it cannot invent a flag the code does not know about, and a
 * row whose key has left this file is ignored.
 *
 * Adding one:
 *
 * 1. Add the entry. Pick the `kind` honestly — a `release` flag is debt with a
 *    due date (`expiresAt`), and `pnpm check:flags` fails CI once it passes.
 * 2. Choose `defaultValue` as the *safe* answer: what every user gets before
 *    anyone saves targeting and whenever the flag service cannot answer. For a
 *    new feature that is `false`; for a kill switch guarding something already
 *    live, `true` — an outage should not take the feature down with it.
 *    Switching a flag *off* is different: it serves `false` (or the default
 *    variant), so a pulled kill switch goes dark whatever its default.
 * 3. Set `client: false` unless a client renders something differently for it.
 *    A server-only flag never goes over the wire.
 *
 * Removing one: delete the entry and every reader the compiler then names.
 */
export const FEATURE_FLAGS = {
  /**
   * Kill switch for minting API tokens. Live by default; switching it off stops
   * new tokens being created (the API refuses with `FLAG_003`, and a client
   * that offers token creation hides it) without touching tokens that already
   * exist.
   */
  api_token_creation: {
    description: 'Allow users to create new personal API tokens.',
    kind: 'ops',
    owner: 'platform',
    type: 'boolean',
    defaultValue: true,
    client: true,
    bucketBy: 'user',
  },
  /**
   * The console's workspace change feed (`GET /v1/events`). On, each console
   * tab holds one Server-Sent Events stream and refetches what a change
   * names as it happens; off, the API refuses the stream (`FLAG_003`). While
   * a stream is live, the polls whose facts it carries stand down; they poll
   * again the moment it drops. Rolled out by workspace. A tab that is
   * already streaming closes it the next time it reads the flag off (a
   * refocus refetches flags); until then the API keeps serving the open one.
   */
  workspace_event_stream: {
    description:
      'Push workspace changes to the console over one event stream; the polls it covers stand down while it is live.',
    kind: 'release',
    owner: 'console',
    type: 'boolean',
    defaultValue: false,
    client: true,
    expiresAt: '2027-01-31',
  },
  /**
   * Kill switch for the session terminal's predictive local echo: a key the
   * console can predict (a character typed at the cursor, Backspace, Left,
   * Right) is drawn before the host echoes it, over the grid and never in it,
   * and dropped the moment the host disagrees. Drawn only once the measured
   * keystroke round trip is above 30 ms.
   *
   * Default `true`, the exception to "new feature: `false`": it is the
   * terminal's intended behaviour rather than an experiment, the console has
   * no flags screen to switch it on from, and a wrong guess costs one frame of
   * overlay. Switching it off returns panes to the host's echo at their next
   * mount. The latency readout (`localStorage['oppenheimer.terminal.latency']`)
   * is a measuring tool for whoever tunes this, not a second switch: it shows
   * the round trip and changes nothing.
   */
  terminal_typeahead: {
    description: "Draw typed characters in the session terminal before the host's echo arrives.",
    kind: 'ops',
    owner: 'console',
    type: 'boolean',
    defaultValue: true,
    client: true,
    bucketBy: 'user',
  },
  /**
   * The direct terminal path (`product/versions/mvp/22-direct-terminal-path.md`):
   * a session's terminal moves from the relay to a WebRTC data channel between
   * the browser and its host once one connects, and falls back to the relay if
   * it cannot. Read by the console, which offers only while it is on, and by
   * the relay, which offers a direct path only to someone it is on for. Off by
   * default while it is new; bucketed by person, since it is a per-reader
   * choice of path, not a workspace's product.
   */
  terminal_direct_path: {
    description:
      'Move session terminals to a direct WebRTC channel with their host when one connects.',
    kind: 'release',
    owner: 'console',
    type: 'boolean',
    defaultValue: false,
    client: true,
    bucketBy: 'user',
    expiresAt: '2027-04-30',
  },
  /**
   * The chat view of a Claude Code session
   * (`product/next-steps/0.7-terminal-and-chat.md`): beside the terminal, the
   * conversation read off the agent's own transcript, which the host follows
   * while the terminal is attached, drawn as prompts, replies and tool cards.
   * The agent still runs in its terminal; typing in the chat types into it.
   * A proof of concept, so off by default; bucketed by person, since the view
   * is a reader's choice.
   */
  session_chat_view: {
    description:
      "Offer a chat view of a Claude Code session beside its terminal, read off the agent's transcript.",
    kind: 'release',
    owner: 'console',
    type: 'boolean',
    defaultValue: false,
    client: true,
    bucketBy: 'user',
    expiresAt: '2027-04-30',
  },
  /**
   * Dictation in the console (`product/next-steps/voice.md`): the composer's
   * mic records, the API transcribes on the workspace's ChatGPT sign-in or
   * the deployment's speech key, and the text lands in the field to read
   * before sending. Read by the console, which shows the mic only while it is
   * on, and by `POST /v1/voice/transcriptions`.
   *
   * Default `true`, like `terminal_typeahead`: dictation is live in every
   * prose field, the console has no flags screen, and nothing happens without
   * a provider (the mic shows only where one can hear the workspace). The
   * flag is its kill switch: a deployment turns it off through the flag
   * admin API.
   */
  voice_dictation: {
    description: 'Dictate prompts into the console with the microphone.',
    kind: 'ops',
    owner: 'console',
    type: 'boolean',
    defaultValue: true,
    client: true,
    bucketBy: 'user',
  },
} as const satisfies Record<string, FlagDefinition>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

type Catalog = typeof FEATURE_FLAGS;

/**
 * Keys of the boolean flags — the only kind that can gate a capability. A
 * variant flag has no "off" arm (its control is a variant like any other), so
 * asking whether one is enabled has no honest answer.
 */
export type BooleanFeatureFlagKey = {
  [K in FeatureFlagKey]: Catalog[K]['type'] extends 'boolean' ? K : never;
}[FeatureFlagKey];

export type ClientFeatureFlagKey = {
  [K in FeatureFlagKey]: Catalog[K]['client'] extends true ? K : never;
}[FeatureFlagKey];

/**
 * The value type of one flag: `boolean` for a boolean flag, the union of its
 * variant names for a multivariate one.
 */
export type FeatureFlagValueOf<K extends FeatureFlagKey> = Catalog[K] extends {
  type: 'variant';
  variants: readonly (infer V extends string)[];
}
  ? V
  : boolean;

/** Every declared key, in catalog order. */
export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

/** The keys clients may read, in catalog order. */
export const CLIENT_FEATURE_FLAG_KEYS = FEATURE_FLAG_KEYS.filter(
  (key) => (FEATURE_FLAGS[key] as FlagDefinition).client,
) as ClientFeatureFlagKey[];

export function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return Object.hasOwn(FEATURE_FLAGS, key);
}

/** The definition behind a key, widened so callers can branch on `type`. */
export function getFlagDefinition(key: FeatureFlagKey): FlagDefinition {
  return FEATURE_FLAGS[key] as FlagDefinition;
}

export function isValidFlagValue(definition: FlagDefinition, value: unknown): value is FlagValue {
  if (definition.type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && definition.variants.includes(value);
}
