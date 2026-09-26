import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { EmailService } from '@oppenheimer/backend-email';
import { I18nService, type LocalizedFormatter } from '@oppenheimer/backend-i18n';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Job } from 'bullmq';
import type { LocaleResolverPort } from '../../profile/application/locale-resolver.port';
import { LOCALE_RESOLVER } from '../../profile/profile.di-tokens';
import { EmailJobMapper, type EmailLocaleTarget } from '../email-job.mapper';

@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    @Inject(LOCALE_RESOLVER)
    private readonly locales: LocaleResolverPort,
    private readonly mapper: EmailJobMapper,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing email job ${job.id}: ${job.name}`);

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
