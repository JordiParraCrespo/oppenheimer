import type { Scope } from '@oppenheimer/shared';

/**
 * One look a bot asked for with `check_back`, as its job carries it: the
 * chain and step, what it is about, and what the turn that set it acted
 * with, so the look's turn reaches no further than that turn did.
 */
export interface CheckBack {
  botId: string;
  organizationId: string;
  /** The turn whose `check_back` call set this look. */
  originTurnId: string;
  chainId: string;
  /** Which look of the chain, from 0. */
  step: number;
  /** When the chain's first look was set. */
  chainStartedAt: Date;
  about: string;
  /** When the look is due. */
  at: Date;
  /** The scopes of the credential the setting turn was sent with; null for a browser session. */
  credentialScopes: readonly Scope[] | null;
  /** The setting turn's IANA zone. */
  timeZone: string;
}

/**
 * Owes a bot a look at `look.at`, durably: the look's turn is queued once the
 * time comes, across a restart.
 */
export interface BotCheckBacksPort {
  schedule(look: CheckBack, correlationId: string | null): Promise<void>;
}
