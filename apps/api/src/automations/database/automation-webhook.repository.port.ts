import type { RoutineWebhookView } from '../domain/routine-webhook.types';

export type { RoutineWebhookView };

/** A routine's webhook as the receiving endpoint reads it. */
export interface RoutineWebhookRecord extends RoutineWebhookView {
  organizationId: string;
  signingSecretSealed: Buffer | null;
}

export interface IssuedRoutineWebhook {
  organizationId: string;
  automationId: string;
  tokenHash: string;
  tokenPrefix: string;
  signingSecretSealed: Buffer | null;
  /** Whether the issuer's email was verified at the issue (`CredentialIssuance`). */
  issuedVerified: boolean;
}

export interface AutomationWebhookRepositoryPort {
  /** Store a routine's URL, replacing the one it had: the old token stops working at once. */
  issue(webhook: IssuedRoutineWebhook): Promise<RoutineWebhookView>;
  /** Forget a routine's URL; a routine without one is not an error. */
  revoke(organizationId: string, automationId: string): Promise<void>;
  /**
   * Forget every URL of these workspaces that was issued, up to `issuedUpTo`,
   * by someone whose email was not verified then. One statement; answers how
   * many it removed.
   */
  revokeIssuedUnverified(organizationIds: readonly string[], issuedUpTo: Date): Promise<number>;
  findByTokenHash(tokenHash: string): Promise<RoutineWebhookRecord | null>;
  /** The URLs of these routines, by routine id; a routine without one is absent. */
  findViews(
    organizationId: string,
    automationIds: readonly string[],
  ): Promise<Map<string, RoutineWebhookView>>;
  markReceived(organizationId: string, automationId: string, at: Date): Promise<void>;
}
