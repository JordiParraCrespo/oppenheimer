/** How bad a reported error is. */
export type ErrorReportLevel = 'fatal' | 'error' | 'warning';

/** What a report says besides the error: searchable tags and a level. Never a secret or a message's text. */
export interface ErrorReportContext {
  readonly level?: ErrorReportLevel;
  readonly tags?: Readonly<Record<string, string | number | boolean | null | undefined>>;
}

/**
 * Platform-agnostic error reporting: each platform adapts its provider SDK
 * (`@sentry/react` in the browser) to it, so the rest of the frontend never
 * imports a vendor SDK. The user is an id only.
 */
export interface IErrorReportingClient {
  capture(error: unknown, context?: ErrorReportContext): void;
  /** The signed-in account's id, or null once nobody is. */
  setUser(userId: string | null): void;
}
