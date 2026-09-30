import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { Test, type TestingModule } from '@nestjs/testing';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Queue } from 'bullmq';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { configStub } from '../../config/__tests__/config-stub';
import {
  DEFAULT_JOB_OPTIONS,
  DURABLE_JOB_OPTIONS,
  EMAIL_JOB_OPTIONS,
} from '../../config/queue-options.config';
import { INBOUND_EVENT_REPOSITORY } from '../../inbound-events/inbound-events.di-tokens';
import { InboundEventsProcessor } from '../../inbound-events/infrastructure/inbound-events.processor';
import { ProfileModule } from '../../profile/profile.module';
import { EmailProcessor } from '../infrastructure/email.processor';
import { QueueModule } from '../queue.module';

// The profile module's import graph reaches Better Auth, whose standalone
// email queue connects to Redis the moment it is imported.
vi.mock('../../auth/infrastructure/email-queue.util', () => ({
  emailQueue: { add: vi.fn(), close: vi.fn(), on: vi.fn() },
  enqueueEmailBestEffort: vi.fn(),
}));

const SRC = resolve(__dirname, '../..');

/**
 * A second `BullModule.registerQueue` for a queue already registered with
 * other options becomes a second `Queue` instance, and `@InjectQueue` hands a
 * provider the one its own module imported: the inbound-events processor got
 * a queue with no retention that way. So a queue is registered in one place.
 */
describe('queue registration', () => {
  it('happens in QueueModule and nowhere else', () => {
    const registering = (readdirSync(SRC, { recursive: true }) as string[])
      .filter((file) => file.endsWith('.module.ts'))
      .filter((file) => readFileSync(join(SRC, file), 'utf8').includes('registerQueue'))
      .map((file) => relative(SRC, join(SRC, file)));

    expect(registering).toEqual([join('queue', 'queue.module.ts')]);
  });

  /**
   * Stands in for `InboundEventsModule`: the real processor, provided in a
   * module that reaches its queue the way the real one does, through
   * `QueueModule`. The ORM behind its repository cannot boot here.
   */
  @Module({
    imports: [CqrsModule, QueueModule],
    providers: [
      InboundEventsProcessor,
      { provide: INBOUND_EVENT_REPOSITORY, useValue: {} },
      { provide: ConfigService, useValue: configStub() },
    ],
  })
  class InboundEventsStandInModule {}

  /** `ProfileModule` configures the ORM; the email worker is not built here. */
  @Module({})
  class ProfileStubModule {}

  describe('the queues providers receive', () => {
    let moduleRef: TestingModule;

    beforeAll(async () => {
      // Compiled, never initialised: no worker starts, and `lazyConnect`
      // keeps every queue off Redis, so there is no connection to close.
      moduleRef = await Test.createTestingModule({
        imports: [
          BullModule.forRoot({
            connection: { lazyConnect: true },
            defaultJobOptions: DEFAULT_JOB_OPTIONS,
          }),
          QueueModule,
          InboundEventsStandInModule,
        ],
      })
        .overrideModule(ProfileModule)
        .useModule(ProfileStubModule)
        .overrideProvider(EmailProcessor)
        .useValue({})
        .compile();
    });

    it('gives the inbound-events processor the durable queue', () => {
      const processor = moduleRef.select(InboundEventsStandInModule).get(InboundEventsProcessor);
      const queue = (processor as unknown as { queue: Queue }).queue;

      expect(queue.opts.defaultJobOptions).toEqual(DURABLE_JOB_OPTIONS);
      expect(queue).toBe(moduleRef.get(getQueueToken(QUEUE_NAMES.INBOUND_EVENTS)));
    });

    it.each([
      [QUEUE_NAMES.EMAIL, EMAIL_JOB_OPTIONS],
      [QUEUE_NAMES.AUTOMATION_RUNS, DURABLE_JOB_OPTIONS],
      // Scheduler-driven queues keep the root removal policy.
      [QUEUE_NAMES.HOST_RETENTION, DEFAULT_JOB_OPTIONS],
      [QUEUE_NAMES.AUTOMATION_SCHEDULES, DEFAULT_JOB_OPTIONS],
      [QUEUE_NAMES.AUTOMATION_RETENTION, DEFAULT_JOB_OPTIONS],
      [QUEUE_NAMES.OUTBOX_RETENTION, DEFAULT_JOB_OPTIONS],
    ])('gives the %s queue its options', (name, options) => {
      const queue = moduleRef.get<Queue>(getQueueToken(name));

      expect(queue.opts.defaultJobOptions).toEqual(options);
    });
  });
});
