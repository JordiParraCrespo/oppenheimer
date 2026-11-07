import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { RequestContextService } from '@oppenheimer/backend-ddd';
import * as Sentry from '@sentry/nestjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorReporter } from '../error-reporter.service';
import { ErrorReportingModule } from '../error-reporting.module';
import { initErrorReporting } from '../init-error-reporting';

interface SentEvent {
  level?: string;
  tags?: Record<string, string>;
  user?: Record<string, unknown>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

/** What left the process: the events of every envelope the client built. */
const sent: SentEvent[] = [];

// Regression: a report without the correlation id (nothing ties it to the
// logs), with one report's tags leaking into the next, or with a secret.
describe('ErrorReportingModule with a DSN', () => {
  let reporter: ErrorReporter;

  beforeAll(async () => {
    // Port 9 refuses at once: nothing is sent anywhere, the envelope is read before.
    initErrorReporting({ dsn: 'http://public@127.0.0.1:9/1', environment: 'test', service: 'api' });
    Sentry.getClient()?.on('beforeEnvelope', (envelope) => {
      for (const [header, body] of envelope[1]) {
        if ((header as { type?: string }).type === 'event') sent.push(body as SentEvent);
      }
    });
    const moduleRef = await Test.createTestingModule({
      imports: [ErrorReportingModule.forRoot()],
    }).compile();
    reporter = moduleRef.get(ErrorReporter);
  });

  afterAll(async () => {
    await Sentry.close(100);
  });

  it('reports through Sentry, tagged and scoped to the one report', async () => {
    expect(reporter.enabled).toBe(true);

    RequestContextService.run({ correlationId: 'corr-1' }, () =>
      reporter.capture(new Error('boom'), {
        level: 'warning',
        tags: { queue: 'bot-turns', attempt: 3, skipped: undefined },
        extra: { jobId: 'j1', apiKey: 'k' },
        fingerprint: ['queue', 'bot-turns'],
        userId: 'u1',
        workspaceId: 'w1',
      }),
    );
    reporter.capture(new Error('second'));
    await reporter.flush(500);

    const [first, second] = sent;
    expect(first?.level).toBe('warning');
    expect(first?.tags).toMatchObject({
      service: 'api',
      correlation_id: 'corr-1',
      workspace_id: 'w1',
      queue: 'bot-turns',
      attempt: 3,
    });
    expect(first?.tags).not.toHaveProperty('skipped');
    expect(first?.user).toEqual({ id: 'u1' });
    expect(first?.extra).toEqual({ jobId: 'j1', apiKey: '[redacted]' });
    expect(first?.fingerprint).toEqual(['queue', 'bot-turns']);

    expect(second?.level).toBe('error');
    expect(second?.tags).not.toHaveProperty('queue');
    expect(second?.user).toBeUndefined();
  });
});
