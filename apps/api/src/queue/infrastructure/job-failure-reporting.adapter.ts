import { WorkerHost } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ErrorReporter } from '@oppenheimer/backend-error-reporting';
import type { Job } from 'bullmq';
import { jobFailureReportOf } from './job-failure-report.util';

/**
 * Reports a job that failed for good: out of retries, or failed with
 * `UnrecoverableError`. A failure BullMQ will retry is not reported; the
 * retry may pass, and the one that does not is.
 *
 * Every processor's worker is found and listened to here, once, so a new
 * processor is reported without remembering to: none of them carries an
 * `@OnWorkerEvent('failed')` of its own for this.
 */
@Injectable()
export class JobFailureReportingAdapter implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reporter: ErrorReporter,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.reporter.enabled) return;
    for (const wrapper of this.discovery.getProviders()) {
      const host: unknown = wrapper.instance;
      if (!(host instanceof WorkerHost)) continue;
      const worker = workerOf(host);
      // `generate:openapi` builds the app without starting workers.
      if (!worker) continue;
      worker.on('failed', (job: Job | undefined, error: Error) => {
        const report = jobFailureReportOf(worker.name, job, error);
        if (report) this.reporter.capture(error, report);
      });
    }
  }
}

/** The host's worker, or null before `@nestjs/bullmq` has made it. */
function workerOf(host: WorkerHost): WorkerHost['worker'] | null {
  try {
    return host.worker;
  } catch {
    return null;
  }
}
