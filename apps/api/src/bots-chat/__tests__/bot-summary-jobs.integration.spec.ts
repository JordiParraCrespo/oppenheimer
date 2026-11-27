import type { CommandBus } from '@nestjs/cqrs';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { LlmRateLimitError } from '@oppenheimer/backend-llm';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { type ConnectionOptions, Queue, Worker } from 'bullmq';
import { DataSource, type Repository } from 'typeorm';
import { createTestDatabase, useTestRedis } from '../../__tests__/integration-services';
import { DURABLE_JOB_OPTIONS } from '../../config/queue-options.config';
import { OutboxRelayService } from '../../outbox/infrastructure/outbox-relay.adapter';
import type { BotConversationSummaryMapper } from '../bot-conversation-summary.mapper';
import type { BotConversationSummaryOrmEntity } from '../database/bot-conversation-summary.orm-entity';
import { BotConversationSummaryRepository } from '../database/bot-conversation-summary.repository';
import { BotSummariesProcessor } from '../infrastructure/bot-summaries.processor';

/**
 * A bot's summary jobs from staging to BullMQ, on a real Postgres outbox, the
 * real relay and a real Redis: however many turn ends stage a fold for one
 * bot, one job per bot is pending. Concurrent staging makes one job per bot
 * (and one each for two bots of two workspaces); a job delayed until a rate
 * limit's reset takes in what is staged meanwhile and keeps the reset it was
 * given; one staged while a fold runs is kept and runs once after it.
 *
 * Regression: every row became a job of its own, so one rate-limited bot held
 * dozens of delayed folds that all woke at the reset and were refused again
 * (thousands of warnings a day for one bot). What a fold does is the command
 * handler's spec; the processor's outcomes are its own.
 */
describe('bot summary jobs (integration)', () => {
  let dataSource: DataSource;
  let outbox: OutboxService;
  let relay: OutboxRelayService;
  let summaries: BotConversationSummaryRepository;
  let queue: Queue;
  let connection: ConnectionOptions;
  let worker: Worker | undefined;
  /** Lets a fold held running finish, so a failed assertion cannot hang the worker's close. */
  let release = () => {};

  beforeAll(async () => {
    const db = await createTestDatabase();
    await useTestRedis();
    connection = {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
      db: Number(process.env.REDIS_DB),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    };
    dataSource = new DataSource({ type: 'postgres', url: db.url, entities: [OutboxMessageSchema] });
    await dataSource.initialize();
    outbox = new OutboxService(dataSource);
    queue = new Queue(QUEUE_NAMES.BOT_SUMMARIES, {
      connection,
      defaultJobOptions: DURABLE_JOB_OPTIONS,
    });
    relay = new OutboxRelayService(
      outbox,
      {} as EventEmitter2,
      new Map([[QUEUE_NAMES.BOT_SUMMARIES, queue]]),
      new Set([QUEUE_NAMES.BOT_SUMMARIES]),
    );
    relay.onApplicationBootstrap();
    // Staging reads nothing but the outbox.
    summaries = new BotConversationSummaryRepository(
      {} as Repository<BotConversationSummaryOrmEntity>,
      outbox,
      {} as BotConversationSummaryMapper,
    );
  }, 180000);

  afterEach(async () => {
    release();
    await worker?.close();
    worker = undefined;
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await relay?.onApplicationShutdown();
    await queue?.close();
    await dataSource?.destroy();
  });

  /** Until the relay has added every staged row to the queue. */
  async function delivered(): Promise<void> {
    await until(async () => {
      const [{ pending }] = await dataSource.query(
        `SELECT count(*)::int AS pending FROM outbox_message WHERE status = 'pending'`,
      );
      return pending === 0;
    });
  }

  /** A worker that runs the real processor over a command bus that does `execute`. */
  function work(execute: () => Promise<void>): void {
    const commandBus = { execute };
    const processor = new BotSummariesProcessor(commandBus as unknown as CommandBus);
    worker = new Worker(QUEUE_NAMES.BOT_SUMMARIES, (job, token) => processor.process(job, token), {
      connection,
      concurrency: 1,
    });
  }

  const stage = (organizationId: string, botId: string, times: number) =>
    Array.from({ length: times }, () => summaries.stageSummarize(organizationId, botId, null));

  it('makes one waiting job per bot of the rows staged at once, and keeps two workspaces’ bots apart', async () => {
    await Promise.all([...stage('org-1', 'bot-a', 5), ...stage('org-2', 'bot-b', 3)]);
    await delivered();

    const waiting = await queue.getJobs(['waiting', 'delayed', 'active']);
    expect(waiting.map((job) => job.data).sort((a, b) => a.botId.localeCompare(b.botId))).toEqual([
      { organizationId: 'org-1', botId: 'bot-a' },
      { organizationId: 'org-2', botId: 'bot-b' },
    ]);
  });

  it('folds what is staged while a job waits out a rate limit into it, keeping its reset', async () => {
    const resetAt = new Date(Date.now() + 10 * 60_000);
    work(async () => {
      throw new LlmRateLimitError('anthropic', '429 rate limit reached', resetAt);
    });
    await Promise.all(stage('org-1', 'bot-c', 1));
    await until(async () => (await queue.getDelayedCount()) === 1);

    await Promise.all(stage('org-1', 'bot-c', 4));
    await delivered();

    expect(await queue.getJobCounts('waiting', 'active', 'delayed')).toMatchObject({
      waiting: 0,
      active: 0,
      delayed: 1,
    });
    const [held] = await queue.getDelayed();
    // BullMQ counts the delay from when the job was moved, not from when it was added.
    expect(Math.abs(held.timestamp + held.delay - resetAt.getTime())).toBeLessThan(1_000);
  });

  it('keeps one fold staged while a job runs, and runs it once after that job', async () => {
    const running = new Promise<void>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn<() => Promise<void>>();
    execute.mockImplementationOnce(() => running).mockResolvedValue(undefined);
    work(execute);
    await Promise.all(stage('org-1', 'bot-d', 1));
    await until(async () => (await queue.getActiveCount()) === 1);

    await Promise.all(stage('org-1', 'bot-d', 3));
    await delivered();
    expect(await queue.getJobCounts('waiting', 'delayed')).toMatchObject({
      waiting: 0,
      delayed: 0,
    });

    release();
    await until(async () => (await queue.getCompletedCount()) === 2);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(await queue.getJobCounts('waiting', 'active', 'delayed')).toMatchObject({
      waiting: 0,
      active: 0,
      delayed: 0,
    });
  });
});

async function until(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the queue');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
