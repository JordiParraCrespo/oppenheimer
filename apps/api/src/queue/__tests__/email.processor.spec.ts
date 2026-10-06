import { EmailRateLimitedError, type EmailService } from '@oppenheimer/backend-email';
import { I18nService } from '@oppenheimer/backend-i18n';
import en from '@oppenheimer/translations/en/index.json';
import es from '@oppenheimer/translations/es/index.json';
import type { Job, Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import type { LocaleResolver } from '../../profile/application/locale.resolver';
import { EmailJobMapper } from '../email-job.mapper';
import { EmailProcessor } from '../infrastructure/email.processor';

function setup() {
  const email = {
    sendPasswordReset: vi.fn(),
    sendEmailVerification: vi.fn(),
    sendWelcome: vi.fn(),
    sendInvitation: vi.fn(),
  };
  const locales = {
    resolveForRecipient: vi.fn().mockResolvedValue({ locale: 'es', timeZone: 'UTC' }),
    resolveForEmailRecipient: vi.fn().mockResolvedValue({ locale: 'en', timeZone: 'UTC' }),
  };
  const i18n = new I18nService({
    bundles: { en, es },
    defaultLocale: 'en',
    defaultTimeZone: 'UTC',
    onMissingKey: () => {},
  });
  const queue = { rateLimit: vi.fn().mockResolvedValue(undefined) };
  const processor = new EmailProcessor(
    email as unknown as EmailService,
    i18n,
    locales as unknown as LocaleResolver,
    new EmailJobMapper(),
    queue as unknown as Queue,
  );
  return { email, locales, processor, queue };
}

describe('EmailProcessor', () => {
  it('holds the whole queue until the provider’s reset, without spending an attempt', async () => {
    const { email, processor, queue } = setup();
    const resetAt = new Date(Date.now() + 30_000);
    email.sendWelcome.mockRejectedValue(new EmailRateLimitedError('quota', resetAt));

    // BullMQ's `RateLimitError` puts the job back to wait instead of failing it;
    // a plain rethrow would spend one of the five attempts on the same refusal.
    await expect(
      processor.process({
        id: 'job-9',
        name: 'welcome',
        data: { to: 'ana@example.com', name: 'Ana' },
      } as Job),
    ).rejects.toThrow('bullmq:rateLimitExceeded');
    expect(queue.rateLimit).toHaveBeenCalledWith(expect.any(Number));
    expect(queue.rateLimit.mock.calls[0][0]).toBeGreaterThan(29_000);
  });

  it('lets any other send failure take the job’s ordinary retry', async () => {
    const { email, processor, queue } = setup();
    email.sendWelcome.mockRejectedValue(new Error('SMTP down'));

    await expect(
      processor.process({
        id: 'job-10',
        name: 'welcome',
        data: { to: 'ana@example.com', name: 'Ana' },
      } as Job),
    ).rejects.toThrow('SMTP down');
    expect(queue.rateLimit).not.toHaveBeenCalled();
  });

  it('renders transactional mail in the language the recipient saved', async () => {
    const { email, locales, processor } = setup();

    await processor.process({
      id: 'job-1',
      name: 'password-reset',
      data: { to: 'ana@example.com', userId: 'user-1', url: 'https://example.com/reset' },
    } as Job);

    expect(locales.resolveForRecipient).toHaveBeenCalledWith('user-1');
    expect(email.sendPasswordReset).toHaveBeenCalledWith(
      'ana@example.com',
      expect.objectContaining({ locale: 'es', subject: 'Restablece tu contraseña' }),
    );
  });

  it('resolves an invitation by its address, since the invitee may have no account', async () => {
    const { email, locales, processor } = setup();

    await processor.process({
      id: 'job-2',
      name: 'invitation',
      data: {
        to: 'new@example.com',
        organizationName: 'Acme',
        inviterName: 'Adri',
        role: 'member',
        url: 'https://example.com/invite',
      },
    } as Job);

    expect(locales.resolveForEmailRecipient).toHaveBeenCalledWith('new@example.com');
    expect(locales.resolveForRecipient).not.toHaveBeenCalled();
    expect(email.sendInvitation).toHaveBeenCalledWith(
      'new@example.com',
      expect.objectContaining({ locale: 'en', subject: "You're invited to Acme" }),
    );
  });
});
