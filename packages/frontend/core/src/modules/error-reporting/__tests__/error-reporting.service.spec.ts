import { describe, expect, it } from 'vitest';
import { AppError } from '../../core/errors';
import type { ErrorReportContext, IErrorReportingClient } from '../error-reporting.client';
import { ErrorReportingService } from '../error-reporting.service';

class RecordingClient implements IErrorReportingClient {
  readonly captured: { error: unknown; context?: ErrorReportContext }[] = [];
  user: string | null | undefined;
  capture(error: unknown, context?: ErrorReportContext): void {
    this.captured.push({ error, context });
  }
  setUser(userId: string | null): void {
    this.user = userId;
  }
}

// Regression: every 404 and dropped connection filling the error tracker, so
// the bugs drown; or a broken reporter taking the app down with it.
describe('ErrorReportingService', () => {
  it('reports a bug of ours and drops what the server or the network answered', () => {
    const client = new RecordingClient();
    const service = new ErrorReportingService(client);
    const bug = new TypeError("Cannot read properties of undefined (reading 'map')");

    expect(service.capture(bug, { level: 'error' })).toBe(true);
    expect(
      service.capture(new AppError({ code: 'SESS_404', message: 'Gone' }, { status: 404 })),
    ).toBe(false);
    expect(service.capture({ status: 500, message: 'Internal' })).toBe(false);
    expect(service.capture(new TypeError('Failed to fetch'))).toBe(false);
    expect(service.capture(new DOMException('aborted', 'AbortError'))).toBe(false);

    expect(client.captured).toEqual([{ error: bug, context: { level: 'error' } }]);
  });

  it('never throws when the provider does', () => {
    const service = new ErrorReportingService({
      capture: () => {
        throw new Error('sdk broke');
      },
      setUser: () => {
        throw new Error('sdk broke');
      },
    });
    expect(() => service.capture(new Error('bug'))).not.toThrow();
    expect(() => service.setUser('u1')).not.toThrow();
  });
});
