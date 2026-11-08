import { inject, injectable } from 'inversify';
import { TOKENS } from '../../di/tokens';
import type { ErrorReportContext, IErrorReportingClient } from './error-reporting.client';
import { reportableErrorOf } from './is-reportable-error';

/**
 * The one place the frontend reports an error. Only the bug a failure is or
 * wraps is sent (`reportableErrorOf`); a failing reporter never breaks the app
 * it reports on.
 */
@injectable()
export class ErrorReportingService {
  constructor(
    @inject(TOKENS.ErrorReportingClient)
    private readonly client: IErrorReportingClient,
  ) {}

  /** Reports `error` when it is a bug of ours; true when it was handed on. */
  capture(error: unknown, context?: ErrorReportContext): boolean {
    const bug = reportableErrorOf(error);
    if (bug === undefined) return false;
    this.safely('capture', () => this.client.capture(bug, context));
    return true;
  }

  setUser(userId: string | null): void {
    this.safely('setUser', () => this.client.setUser(userId));
  }

  private safely(operation: string, fn: () => void): void {
    try {
      fn();
    } catch (error) {
      console.warn(`[error-reporting] ${operation} failed`, error);
    }
  }
}
