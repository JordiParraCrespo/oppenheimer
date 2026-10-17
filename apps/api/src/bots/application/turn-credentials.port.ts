import type { BotProvider } from '@oppenheimer/shared';

/** What a turn runs on: the provider's key, or a sign-in's access token and the account it acts for. Never logged. */
export interface TurnCredential {
  apiKey: string;
  accountId?: string;
}

/**
 * The credential a turn of a bot in a workspace runs on, whatever kind its
 * provider takes (`TURN_CREDENTIALS`). The turn worker asks this and nothing
 * else, so it never knows which providers sign in and which take a key.
 */
export interface TurnCredentialsPort {
  /** `BOTS_013` when the workspace has none for that provider. */
  forTurn(organizationId: string, provider: BotProvider, now: Date): Promise<TurnCredential>;
  /**
   * Whether the workspace has a credential for `provider` that `forTurn`
   * could open: a stored key or sign-in, and the key it is sealed under.
   * A row read, never a refresh, so a caller can ask it on every request.
   */
  has(organizationId: string, provider: BotProvider): Promise<boolean>;
}
