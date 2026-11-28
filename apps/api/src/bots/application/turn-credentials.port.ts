import type { BotTurnFailure, ModelProvider } from '@oppenheimer/shared';

/** What a turn runs on: the provider's key, or a sign-in's access token and the account it acts for. Never logged. */
export interface TurnCredential {
  apiKey: string;
  accountId?: string;
  /** The stored key it is, when it is one of a provider's keys: what `spent` names. */
  keyId?: string;
}

/**
 * The credential a turn of a bot in a workspace runs on, whatever kind its
 * provider takes (`TURN_CREDENTIALS`). The turn worker asks this and nothing
 * else, so it never knows which providers sign in and which take a key.
 */
export interface TurnCredentialsPort {
  /** `BOTS_013` when the workspace has none for that provider. */
  forTurn(organizationId: string, provider: ModelProvider, now: Date): Promise<TurnCredential>;
  /**
   * Whether the workspace has a credential for `provider` that `forTurn`
   * could open: a stored key or sign-in, and the key it is sealed under.
   * A row read, never a refresh, so a caller can ask it on every request.
   */
  has(organizationId: string, provider: ModelProvider): Promise<boolean>;
  /**
   * The provider refused a call on `used` because the account behind it is out
   * of credit or quota: marks that key spent (unless it was replaced since),
   * and answers the key to try next, or null when the provider has no key left
   * that is not spent (or `used` was a sign-in, which has no other).
   */
  spent(
    organizationId: string,
    provider: ModelProvider,
    used: TurnCredential,
    now: Date,
  ): Promise<TurnCredential | null>;
  /**
   * Whether a turn that ended with `failure` leaves the provider a key to go
   * on with: only a refusal for credit (`usage_limit`) does, and only while a
   * stored key is not marked spent, so a hold or a pause waiting for the
   * account to be topped up is not needed. Never for a sign-in, which has no
   * other. The one place that decides it; read before a hold or a pause.
   */
  keyLeftAfter(
    organizationId: string,
    provider: ModelProvider,
    failure: BotTurnFailure | null | undefined,
  ): Promise<boolean>;
  /** A call on `used` got through: a spent mark it carried (it was topped up) goes. */
  worked(organizationId: string, provider: ModelProvider, used: TurnCredential): Promise<void>;
}
