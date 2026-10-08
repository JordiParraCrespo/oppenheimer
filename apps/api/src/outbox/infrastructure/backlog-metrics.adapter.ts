import { getQueueToken } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { describeError, InjectMetric, type ModuleMetrics } from '@oppenheimer/backend-core';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';

export const QUEUE_JOBS = 'queue_jobs';
export const OUTBOX_MESSAGES = 'outbox_messages';
export const OUTBOX_OLDEST_PENDING_AGE_SECONDS = 'outbox_oldest_pending_age_seconds';
export const BACKLOG_SAMPLE_SUCCESS = 'backlog_sample_success';
export const BACKLOG_SAMPLE_TIMESTAMP_SECONDS = 'backlog_sample_timestamp_seconds';

/** The job states a queue is read in; `paused` and `completed` are left out (no queue pauses, completed jobs are removed). */
export const QUEUE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'failed'] as const;
const SOURCES = ['queues', 'outbox'] as const;

export const BacklogMetrics: ModuleMetrics = {
  [QUEUE_JOBS]: {
    type: 'gauge',
    help: 'BullMQ jobs by queue and state, at the last sample',
    labelNames: ['queue', 'state'],
  },
  [OUTBOX_MESSAGES]: {
    type: 'gauge',
    help: 'Outbox rows not yet delivered, by status (pending is owed, failed waits for a person)',
    labelNames: ['status'],
  },
  [OUTBOX_OLDEST_PENDING_AGE_SECONDS]: {
    type: 'gauge',
    help: 'Age of the oldest pending outbox row; 0 when none is pending',
  },
  [BACKLOG_SAMPLE_SUCCESS]: {
    type: 'gauge',
    help: 'Whether the latest backlog sample succeeded, by source',
    labelNames: ['source'],
  },
  [BACKLOG_SAMPLE_TIMESTAMP_SECONDS]: {
    type: 'gauge',
    help: 'Unix time of the last successful backlog sample, by source',
    labelNames: ['source'],
  },
};

interface GaugeLike {
  set(labels: Record<string, string>, value: number): void;
  set(value: number): void;
}

interface CountableQueue {
  getJobCounts(...states: string[]): Promise<Record<string, number>>;
}

/**
 * Samples the work the API owes: jobs in each BullMQ queue and outbox rows not
 * yet delivered. Bull Board shows the queues live, but only to someone who
 * opens it; a gauge is what makes a backlog graphable and alertable.
 *
 * On a timer rather than at scrape time, so a slow database cannot stall the
 * scrape, and only while `METRICS_TOKEN` is set: nothing reads the gauges
 * otherwise. The next pass is scheduled when the current one settles, so a
 * slow dependency spaces the samples out instead of stacking them. A failed
 * sample keeps the last values and says so in `backlog_sample_success`; a
 * stale one shows in the timestamp.
 *
 * Every queue is resolved at bootstrap, metrics or not: a queue that is not
 * registered fails the boot naming it, rather than the first sample.
 */
@Injectable()
export class BacklogMetricsSampler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(BacklogMetricsSampler.name);
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;
  private queues: [string, CountableQueue][] = [];

  constructor(
    @InjectMetric(QUEUE_JOBS) private readonly queueJobs: GaugeLike,
    @InjectMetric(OUTBOX_MESSAGES) private readonly outboxMessages: GaugeLike,
    @InjectMetric(OUTBOX_OLDEST_PENDING_AGE_SECONDS) private readonly oldestPending: GaugeLike,
    @InjectMetric(BACKLOG_SAMPLE_SUCCESS) private readonly sampleSuccess: GaugeLike,
    @InjectMetric(BACKLOG_SAMPLE_TIMESTAMP_SECONDS) private readonly sampleTimestamp: GaugeLike,
    private readonly outbox: OutboxService,
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    this.queues = Object.values(QUEUE_NAMES).map((name) => [name, this.resolveQueue(name)]);
    for (const source of SOURCES) this.sampleSuccess.set({ source }, 0);
    if (!this.configService.get<string>('health.metricsToken')) return;
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** One pass over both sources; each records its own success, neither throws. */
  async sample(): Promise<void> {
    await Promise.all([
      this.record('queues', () => this.sampleQueues()),
      this.record('outbox', () => this.sampleOutbox()),
    ]);
  }

  /** Sample, then schedule the next pass only once this one has settled. */
  private async loop(): Promise<void> {
    await this.sample();
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.loop(), this.intervalMs);
    this.timer.unref();
  }

  private resolveQueue(name: string): CountableQueue {
    try {
      // Not `strict`: the queue tokens are declared by `BullModule`, which
      // `QueueModule` re-exports, not by this module.
      return this.moduleRef.get<CountableQueue>(getQueueToken(name), { strict: false });
    } catch (error) {
      throw new Error(
        `Backlog metrics: queue "${name}" is not registered in QueueModule (${describeError(error)})`,
      );
    }
  }

  private async sampleQueues(): Promise<void> {
    const counts = await Promise.all(
      this.queues.map(
        async ([name, queue]) => [name, await queue.getJobCounts(...QUEUE_STATES)] as const,
      ),
    );
    for (const [queue, byState] of counts) {
      for (const state of QUEUE_STATES) this.queueJobs.set({ queue, state }, byState[state] ?? 0);
    }
  }

  private async sampleOutbox(): Promise<void> {
    // One statement, one snapshot: every gauge below comes from the same read.
    const { pending, failed, oldestPendingAt } = await this.outbox.backlog();
    this.outboxMessages.set({ status: 'pending' }, pending);
    this.outboxMessages.set({ status: 'failed' }, failed);
    this.oldestPending.set(
      oldestPendingAt ? Math.max(0, (Date.now() - oldestPendingAt.getTime()) / 1_000) : 0,
    );
  }

  private async record(source: (typeof SOURCES)[number], read: () => Promise<void>): Promise<void> {
    try {
      await read();
      this.sampleSuccess.set({ source }, 1);
      this.sampleTimestamp.set({ source }, Date.now() / 1_000);
    } catch (error) {
      this.sampleSuccess.set({ source }, 0);
      this.logger.warn({ message: 'Backlog sample failed', source, error: describeError(error) });
    }
  }

  private get intervalMs(): number {
    return this.configService.getOrThrow<number>('health.metricsSampleIntervalMs');
  }
}
