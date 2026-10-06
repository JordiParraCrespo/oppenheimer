import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { EmailRateLimitedError, EmailService } from '@oppenheimer/backend-email';
import { I18nService, type LocalizedFormatter } from '@oppenheimer/backend-i18n';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { type Job, type Queue, Worker } from 'bullmq';
import type { LocaleResolverPort } from '../../profile/application/locale-resolver.port';
import { LOCALE_RESOLVER } from '../../profile/profile.di-tokens';
import { EmailJobMapper, type EmailLocaleTarget } from '../email-job.mapper';

/**
 * A ceiling, not a pace: BullMQ honours a manual rate limit
 * ({@link EmailProcessor.holdQueue}) only on a worker that has a `limiter`, so
 * this one is set high enough never to delay ordinary mail. A password reset
 * must not wait behind a burst of sign-ups. The pace a provider wants comes
 * from its own refusal, which holds the queue until its reset.
 */
const SENDS_PER_SECOND = 50;

/**
 * Sends the queued transactional mail.
 *
 * A provider that refuses for rate or quota (`EmailRateLimitedError`) holds the
 * whole queue until it said it will take mail again, and the job goes back to
 * waiting without spending an attempt: retrying each job on its own backoff
 * would spend all five against the same refusal and drop the mail
 * (`.agents/rules/integrations.md`).
 */
@Processor(QUEUE_NAMES.EMAIL, { limiter: { max: SENDS_PER_SECOND, duration: 1_000 } })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    @Inject(LOCALE_RESOLVER)
    private readonly locales: LocaleResolverPort,
    private readonly mapper: EmailJobMapper,
    @InjectQueue(QUEUE_NAMES.EMAIL)
    private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing email job ${job.id}: ${job.name}`);
    try {
      await this.send(job);
    } catch (error) {
      if (error instanceof EmailRateLimitedError) await this.holdQueue(job, error.resetAt);
      throw error;
    }
  }

  /**
   * Hold every job on the queue until `resetAt`, and put this one back to wait
   * for it. `Worker.RateLimitError` is how BullMQ is told the job did not fail.
   */
  private async holdQueue(job: Job, resetAt: Date): Promise<never> {
    const ms = Math.max(1_000, resetAt.getTime() - Date.now());
    this.logger.warn(`Email provider rate limit: holding the queue ${ms}ms (job ${job.id})`);
    await this.queue.rateLimit(ms);
    throw Worker.RateLimitError();
  }

  private async send(job: Job): Promise<void> {
    switch (job.name) {
      case 'password-reset': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendPasswordReset(
          target.to,
          this.mapper.toPasswordReset(job.data, t),
        );
        break;
      }
      case 'email-verification': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendEmailVerification(
          target.to,
          this.mapper.toEmailVerification(job.data, t),
        );
        break;
      }
      case 'welcome': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendWelcome(target.to, this.mapper.toWelcome(job.data, t));
        break;
      }
      case 'invitation': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendInvitation(target.to, this.mapper.toInvitation(job.data, t));
        break;
      }
      case 'host-paired': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendHostPaired(target.to, this.mapper.toHostPaired(job.data, t));
        break;
      }
      case 'host-network-changed': {
        const target = this.mapper.toLocaleTarget(job.data);
        const t = await this.formatter(target);
        await this.emailService.sendHostNetworkChanged(
          target.to,
          this.mapper.toHostNetworkChanged(job.data, t),
        );
        break;
      }
      default:
        this.logger.warn(`Unknown email job: ${job.name}`);
    }
  }

  /**
   * The language to write in. A job that names the recipient's user id reads
   * their saved preference; one that only has an address (an invitation) is
   * matched to an account by that address, and a stranger gets the default.
   */
  private async formatter(target: EmailLocaleTarget): Promise<LocalizedFormatter> {
    const resolved = target.userId
      ? await this.locales.resolveForRecipient(target.userId)
      : await this.locales.resolveForEmailRecipient(target.to);
    return this.i18n.for(resolved.locale, resolved.timeZone);
  }
}
