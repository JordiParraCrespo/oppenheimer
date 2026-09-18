/** The language and timezone to write something in. */
export interface ResolvedLocale {
  locale: string;
  timeZone: string;
}

/**
 * Which language to write to someone who is not making a request.
 *
 * A queued email has no `Accept-Language` to read, so the only signal is what
 * the recipient saved. The caller says who the recipient is; where the
 * preference is stored, and what the deployment falls back to, is not its
 * business.
 */
export interface LocaleResolverPort {
  /** Resolve for a known account. */
  resolveForRecipient(userId: string): Promise<ResolvedLocale>;

  /**
   * Resolve for an email address: an invitee may already be a user with a
   * saved language, or a brand-new address that gets the default.
   */
  resolveForEmailRecipient(email: string): Promise<ResolvedLocale>;
}
