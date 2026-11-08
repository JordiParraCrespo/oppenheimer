import { WorkerHost } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap, Optional } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ErrorReporter } from '@oppenheimer/backend-error-reporting';
import type { Job } from 'bullmq';
import { JobFailureMapper } from '../job-failure.mapper';
import { isFinalFailure } from './job-failure-report.util';

/**
 * Reports a job that failed for good: out of retries, or failed with
 * `UnrecoverableError`. A failure BullMQ will retry is not reported; the
 * retry may pass, and the one that does not is.
 *
 * Every processor's worker is found and listened to here, once, so a new
 * processor is reported without remembering to: none of them carries an
 * `@OnWorkerEvent('failed')` of its own for this.
 *
 * Why the workers exist by then: `@nestjs/bullmq`'s `BullRegistrar` builds
 * every processor's worker in its `onModuleInit`, and Nest runs every
 * `onModuleInit` before the first `onApplicationBootstrap`. A worker made
 * with `autorun: false` exists too, and is listened to the same way. The one
 * host with no worker is an app built without the registrar running
 * (`generate:openapi` builds the module graph and stops); `WorkerHost.worker`
 * throws there, and that host is skipped.
 */
@Injectable()
export class JobFailureReportingAdapter implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    // Optional: a spec that builds `QueueModule` alone has no reporter, and
    // reports nothing, as an app with no DSN does.
    @Optional() private readonly reporter?: ErrorReporter,
  ) {}

  onApplicationBootstrap(): void {
    const reporter = this.reporter;
    if (!reporter?.enabled) return;
    for (const wrapper of this.discovery.getProviders()) {
      const host: unknown = wrapper.instance;
      if (!(host instanceof WorkerHost)) continue;
      const worker = workerOf(host);
      if (!worker) continue;
      worker.on('failed', (job: Job | undefined, error: Error) => {
        if (!isFinalFailure(job, error)) return;
        reporter.capture(error, JobFailureMapper.toErrorReport(worker.name, job, error));
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
