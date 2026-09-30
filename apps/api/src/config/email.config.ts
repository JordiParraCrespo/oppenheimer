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

export const emailConfig = registerAs('email', () =>
  parseEnv('email', schema, {
    provider: 'EMAIL_PROVIDER',
    from: 'EMAIL_FROM',
    smtpHost: 'SMTP_HOST',
    smtpPort: 'SMTP_PORT',
    smtpUser: 'SMTP_USER',
    smtpPass: 'SMTP_PASS',
    resendApiKey: 'RESEND_API_KEY',
  }),
);
