import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodemailerEmailService } from './nodemailer-email.service';

vi.mock('nodemailer', () => ({ createTransport: vi.fn(() => ({})) }));

const transportOptions = (smtp: Record<string, unknown>) => {
  const config = { get: (key: string) => smtp[key.replace('email.', '')] };
  new NodemailerEmailService(config as unknown as ConfigService);
  return vi.mocked(nodemailer.createTransport).mock.calls[0][0] as Record<string, unknown>;
};

describe('NodemailerEmailService transport', () => {
  beforeEach(() => vi.mocked(nodemailer.createTransport).mockClear());

  it('speaks TLS from the first byte on 465 and upgrades with STARTTLS elsewhere', () => {
    expect(transportOptions({ smtpHost: 'smtp.test', smtpPort: 465 })).toMatchObject({
      secure: true,
    });
    vi.mocked(nodemailer.createTransport).mockClear();
    expect(transportOptions({ smtpHost: 'smtp.test', smtpPort: 587 })).toMatchObject({
      secure: false,
    });
  });

  it('sends no auth for a relay configured without credentials', () => {
    expect(transportOptions({ smtpHost: 'smtp.test', smtpPort: 25 })).not.toHaveProperty('auth');
    vi.mocked(nodemailer.createTransport).mockClear();
    expect(
      transportOptions({ smtpHost: 'smtp.test', smtpPort: 587, smtpUser: 'u', smtpPass: 'p' }),
    ).toMatchObject({ auth: { user: 'u', pass: 'p' } });
  });
});
