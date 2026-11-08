import { EventEmitter } from 'node:events';
import { WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { type ErrorReportContext, ErrorReporter } from '@oppenheimer/backend-error-reporting';
import type { Job, Worker } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { JobFailureReportingAdapter } from '../infrastructure/job-failure-reporting.adapter';

class RecordingReporter extends ErrorReporter {
  readonly enabled = true;
  readonly reports: { error: unknown; context?: ErrorReportContext }[] = [];
  capture(error: unknown, context?: ErrorReportContext): string {
    this.reports.push({ error, context });
    return 'id';
  }
  async flush(): Promise<boolean> {
    return true;
  }
}

/** A processor as `@nestjs/bullmq` leaves it: its worker made, an event emitter. */
@Injectable()
class SomeProcessor extends WorkerHost {
  readonly fake = Object.assign(new EventEmitter(), { name: 'automation-runs' });
  override get worker(): Worker {
    return this.fake as unknown as Worker;
  }
  async process(): Promise<void> {}
}

function job(attemptsMade: number, attempts: number | undefined): Job {
  return { id: 'j1', name: 'run', attemptsMade, opts: { attempts }, failedReason: 'boom' } as Job;
}

async function boot() {
  const reporter = new RecordingReporter();
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [
      SomeProcessor,
      JobFailureReportingAdapter,
      { provide: ErrorReporter, useValue: reporter },
    ],
  }).compile();
  await moduleRef.init();
  return { reporter, worker: moduleRef.get(SomeProcessor).fake };
}

// Regression: a job that ran out of retries vanishing into Bull Board's failed
// list with nobody told, or every retried attempt paging someone.
describe('JobFailureReportingAdapter', () => {
  it('reports a job once it is out of retries, grouped by queue and job', async () => {
    const { reporter, worker } = await boot();
    const error = new Error('boom');

    worker.emit('failed', job(3, 8), error);
    expect(reporter.reports).toEqual([]);

    worker.emit('failed', job(8, 8), error);
    expect(reporter.reports).toEqual([
      {
        error,
        context: {
          level: 'error',
          tags: { 'queue.name': 'automation-runs', 'queue.job': 'run', 'queue.attempts': 8 },
          extra: { jobId: 'j1', failedReason: 'boom' },
          fingerprint: ['queue-job-failed', 'automation-runs', 'run', 'Error'],
        },
      },
    ]);
  });

  it('reports a single-attempt job and an unrecoverable one on the first failure', async () => {
    const { reporter, worker } = await boot();
    worker.emit('failed', job(1, undefined), new Error('once'));
    const unrecoverable = Object.assign(new Error('stop'), { name: 'UnrecoverableError' });
    worker.emit('failed', job(1, 8), unrecoverable);
    expect(reporter.reports.map((report) => report.error)).toEqual([
      expect.objectContaining({ message: 'once' }),
      unrecoverable,
    ]);
  });
});
