import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

// Optional-capability config: with no transport settings the console provider
// prints emails to stdout.
const schema = z.object({
  provider: z.enum(['console', 'nodemailer', 'resend']).default('console'),
  from: z.string().default('noreply@oppenheimer.dev'),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  resendApiKey: z.string().optional(),
});

type EmailConfig = z.infer<typeof schema>;

/**
 * The `email` section parsed straight from the environment, for Better Auth's
 * config, which is built at module scope and cannot inject `ConfigService`.
 * `emailConfig` below is the same call.
 */
export function emailConfigFromEnv(): EmailConfig {
  return parseEnv('email', schema, {
    provider: 'EMAIL_PROVIDER',
    from: 'EMAIL_FROM',
    smtpHost: 'SMTP_HOST',
    smtpPort: 'SMTP_PORT',
    smtpUser: 'SMTP_USER',
    smtpPass: 'SMTP_PASS',
    resendApiKey: 'RESEND_API_KEY',
  });
}

export const emailConfig = registerAs('email', () => emailConfigFromEnv());

/**
 * Whether this deployment actually delivers mail: the `email_delivery`
 * capability, and the one predicate both it and Better Auth's OAuth gate read.
 * The `console` provider only prints to stdout, which is not delivery.
 */
export function emailDeliveryIsConfigured(
  email: Partial<Pick<EmailConfig, 'provider' | 'smtpHost' | 'resendApiKey'>>,
): boolean {
  return (
    (email.provider === 'nodemailer' && Boolean(email.smtpHost)) ||
    (email.provider === 'resend' && Boolean(email.resendApiKey))
  );
}
