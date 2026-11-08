import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { ErrorReporter } from '../error-reporter.service';
import { ErrorReportingModule } from '../error-reporting.module';
import { initErrorReporting } from '../init-error-reporting';

// Regression: an app with no DSN (tests, local, `generate:openapi`) failing to
// boot, or trying to send, because reporting was not configured.
describe('ErrorReportingModule without a DSN', () => {
  it('provides a reporter that sends nothing', async () => {
    expect(initErrorReporting({ dsn: '  ', environment: 'test', service: 'api' })).toBe(false);

    const moduleRef = await Test.createTestingModule({
      imports: [ErrorReportingModule.forRoot()],
    }).compile();
    const reporter = moduleRef.get(ErrorReporter);

    expect(reporter.enabled).toBe(false);
    expect(reporter.capture(new Error('boom'))).toBeUndefined();
    await expect(reporter.flush()).resolves.toBe(true);
  });
});
