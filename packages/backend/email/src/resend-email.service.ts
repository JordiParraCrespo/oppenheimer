import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type CreateEmailOptions, Resend } from 'resend';
import { EmailRateLimitedError } from './email.errors';
import {
  EmailService,
  type EmailVerificationEmailParams,
  type HostNetworkChangedEmailParams,
  type HostPairedEmailParams,
  type InvitationEmailParams,
  type PasswordResetEmailParams,
  type WelcomeEmailParams,
} from './email.service';
import {
  renderEmailVerificationEmail,
  renderHostNetworkChangedEmail,
  renderHostPairedEmail,
  renderInvitationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from './render';

/** How long to hold the queue after a per-second refusal that named no wait. */
const DEFAULT_RATE_PAUSE_MS = 1_000;

@Injectable()
export class ResendEmailService extends EmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private resend: Resend;

  constructor(private readonly configService: ConfigService) {
    super();
    this.resend = new Resend(this.configService.get('email.resendApiKey'));
  }

  /**
   * `resend.emails.send()` resolves with `{ data, error }` instead of throwing,
   * so without the throw here a failure (misconfigured sender domain, rate
   * limit, invalid recipient) would reach the caller as a successful send.
   *
   * A refusal for rate or quota is an {@link EmailRateLimitedError} carrying
   * when Resend will take mail again, so the queue waits rather than retries.
   */
  private async send(options: CreateEmailOptions): Promise<void> {
    const { data, error, headers } = await this.resend.emails.send(options);

    if (error) {
      const resetAt = rateLimitResetOf(error, headers);
      if (resetAt) {
        this.logger.warn(
          `Resend refused "${options.subject}" for ${error.name}; holding email until ${resetAt.toISOString()}`,
        );
        throw new EmailRateLimitedError(`Resend refused to send: ${error.message}`, resetAt);
      }
      this.logger.error(
        `Failed to send "${options.subject}" email to ${options.to}: ${error.message}`,
      );
      throw new Error(`Resend failed to send email: ${error.message}`);
    }

    this.logger.debug(`Sent "${options.subject}" email to ${options.to} (id: ${data?.id})`);
  }

  private get from(): string {
    return this.configService.get('email.from') || 'noreply@oppenheimer.dev';
  }

  async sendPasswordReset(to: string, params: PasswordResetEmailParams): Promise<void> {
    const html = await renderPasswordResetEmail(params);
    await this.send({
      from: this.from,
      to,
      subject: params.subject,
      html,
    });
  }

  async sendEmailVerification(to: string, params: EmailVerificationEmailParams): Promise<void> {
    const html = await renderEmailVerificationEmail(params);
    await this.send({
      from: this.from,
      to,
      subject: params.subject,
      html,
    });
  }

  async sendWelcome(to: string, params: WelcomeEmailParams): Promise<void> {
    const html = await renderWelcomeEmail(params);
    await this.send({
      from: this.from,
      to,
      subject: params.subject,
      html,
    });
  }

  async sendInvitation(to: string, params: InvitationEmailParams): Promise<void> {
    const html = await renderInvitationEmail(params);
    await this.send({
      from: this.from,
      to,
      subject: params.subject,
      html,
    });
  }

  async sendHostPaired(to: string, params: HostPairedEmailParams): Promise<void> {
    const html = await renderHostPairedEmail(params);
    await this.send({
      from: this.from,
      to,
      subject: params.subject,
      html,
    });
  }

  async sendHostNetworkChanged(to: string, params: HostNetworkChangedEmailParams): Promise<void> {
    const html = await renderHostNetworkChangedEmail(params);
    await this.send({
      from: this.from,
      to,
      subject: params.subject,
      html,
    });
  }
}

/**
 * When Resend will take mail again, for a refusal about rate or quota; `null`
 * for any other. Its `retry-after` and `ratelimit-reset` are seconds from now;
 * a spent daily or monthly quota names no wait, so it is the next UTC day or
 * month, when Resend resets it.
 */
export function rateLimitResetOf(
  error: { name: string; statusCode: number | null },
  headers: Record<string, string> | null,
  now: number = Date.now(),
): Date | null {
  const today = new Date(now);
  switch (error.name) {
    case 'daily_quota_exceeded':
      return new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
      );
    case 'monthly_quota_exceeded':
      return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    case 'rate_limit_exceeded':
      break;
    default:
      if (error.statusCode !== 429) return null;
  }
  const header = (name: string) =>
    Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
  for (const name of ['retry-after', 'ratelimit-reset']) {
    const seconds = Number(header(name));
    if (header(name) !== undefined && Number.isFinite(seconds) && seconds >= 0) {
      return new Date(now + Math.max(seconds * 1000, DEFAULT_RATE_PAUSE_MS));
    }
  }
  return new Date(now + DEFAULT_RATE_PAUSE_MS);
}
