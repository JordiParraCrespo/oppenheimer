import type { AutomationSkipReason } from '@oppenheimer/shared/automations';

/** A routine's webhook as the Routines tab shows it: never its token or secret. */
export interface RoutineWebhookView {
  automationId: string;
  /** `owh_ab12cd`: the start of the token, to tell one URL from the next. */
  tokenPrefix: string;
  signed: boolean;
  /** When the current URL was issued. */
  issuedAt: Date;
  lastReceivedAt: Date | null;
}

/** What a POST to a routine's webhook made. */
export interface ReceivedWebhook {
  runId: string;
  /**
   * `queued` when it will run; `skipped` when an hourly cap turned it away (and
   * recorded it); `duplicate` when an earlier POST with the same
   * `Idempotency-Key` already made this run.
   */
  status: 'queued' | 'skipped' | 'duplicate';
  skipReason: AutomationSkipReason | null;
}
