import { describe, expect, it } from 'vitest';
import { AppError, callApi } from '../../core/errors';
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

  // Regression: a repository's mapper throwing on a response it could not
  // read, wrapped by `callApi` in its fallback error and so never reported.
  it('reports the bug a repository wrapped, and not the network failure it wrapped', () => {
    const client = new RecordingClient();
    const service = new ErrorReportingService(client);
    const unreadable = new TypeError('data.map is not a function');
    const fallback = { code: 'HOSTS_CLIENT_001', message: 'Failed to load hosts' };

    expect(service.capture(new AppError(fallback, { cause: unreadable }))).toBe(true);
    expect(
      service.capture(new AppError(fallback, { cause: new TypeError('Failed to fetch') })),
    ).toBe(false);
    expect(service.capture(new AppError(fallback))).toBe(false);

    expect(client.captured).toEqual([{ error: unreadable, context: undefined }]);
  });

  // Regression (Sentry OPPENHEIMER-WEB-2): the generated SDK hands a dropped
  // connection back as `{ error: TypeError }`, and `unwrap` kept the
  // `{ status, body }` it built from it as the cause, so the filter found no
  // TypeError there and every request in flight reported "Failed to fetch".
  it('drops a network failure that reached it through an SDK call', async () => {
    const client = new RecordingClient();
    const service = new ErrorReportingService(client);
    const fallback = { code: 'BOTS_CLIENT_001', message: 'Failed to mark the bot seen' };
    const dropped = { error: new TypeError('Failed to fetch (dev.oppenheimer.build)') };
    const unreadable = new TypeError('data.map is not a function');
    const answered = { data: {}, response: new Response(null, { status: 200 }) };

    const offline = await callApi(fallback, (api) => api.result(dropped)).catch((e) => e);
    const misread = await callApi(fallback, async (api) => {
      await api.result(answered);
      throw unreadable;
    }).catch((e) => e);

    expect(service.capture(offline)).toBe(false);
    expect(service.capture(misread)).toBe(true);
    expect(client.captured).toEqual([{ error: unreadable, context: undefined }]);
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
