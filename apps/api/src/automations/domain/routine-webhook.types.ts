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
