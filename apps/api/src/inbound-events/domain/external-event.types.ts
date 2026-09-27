import type { ExternalTriggerSource } from '@oppenheimer/shared/automations';

/**
 * The canonical shape of something that happened elsewhere
 * (`product/versions/mvp/16-automations-architecture.md` §Q6).
 *
 * Every source normalizes its deliveries into this, and everything downstream —
 * the automations matcher, the trigger preview, a run's cause and its prompt —
 * reads only this. Adding Slack is a new source that produces the same shape;
 * nothing that consumes it changes.
 */
export interface ExternalEvent {
  source: ExternalTriggerSource;
  /** A type from the trigger catalog (`pr_opened`, `push`, …). */
  type: string;
  /** The provider-stable id of this event, unique per source: the delivery id plus the type. */
  externalId: string;
  /** What it happened to. A repository today; a Slack channel later. */
  subject: { kind: 'repository'; ref: string; name: string };
  actor: { login: string | null; isOwnApp: boolean };
  /**
   * Flat, typed facts filters read (`baseBranch`, `branch`, `label`, `number`,
   * `headSha`, `fork`). Never free text written by somebody else.
   */
  attributes: Record<string, string | number | boolean | string[] | null>;
  /**
   * What a run's prompt carries about the event: title, body, URL, reference.
   * **Untrusted** — written by whoever opened the issue or pushed the commit —
   * so it only ever reaches an agent inside the untrusted-data envelope, and is
   * size-capped here.
   */
  context: ExternalEventContext;
  occurredAt: Date;
  schemaVersion: number;
}

export interface ExternalEventContext {
  /** `#124`, a short sha, a tag, a check name: how a person refers to it. */
  ref?: string;
  title?: string;
  body?: string;
  url?: string;
  /** Anything else a prompt benefits from (head branch, base branch, label). */
  [key: string]: string | number | boolean | undefined;
}

/** A delivery as a source adapter reads it: the event name and the parsed body. */
export interface InboundDelivery {
  id: string;
  source: ExternalTriggerSource;
  deliveryId: string;
  eventName: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
}

/** An event as it is stored in one workspace. */
export interface StoredExternalEvent extends ExternalEvent {
  id: string;
  organizationId: string;
  receivedAt: Date;
}

/** The body cap for untrusted text: enough for an issue, not enough to flood a prompt. */
export const EXTERNAL_CONTEXT_BODY_MAX = 8 * 1024;
