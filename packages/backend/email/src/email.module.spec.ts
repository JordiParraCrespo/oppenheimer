import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { ConsoleEmailService } from './console-email.service';
import { EmailModule } from './email.module';
import { EmailService } from './email.service';

/**
 * The factory that decides which provider a deployment gets. It is one switch
 * statement, and its failure mode is silent: pick the wrong branch and every
 * email in production is written to a log file instead of being delivered, with
 * nothing in the response to say so.
 *
 * `nodemailer` and `resend` construct real clients in their constructors, so
 * those modules are stubbed — the assertion is which branch was taken, not what
 * the client does.
 */

const NodemailerCtor = vi.fn();
const ResendCtor = vi.fn();

vi.mock('./nodemailer-email.service', () => ({
  NodemailerEmailService: class {
    constructor(config: unknown) {
      NodemailerCtor(config);
    }
  },
}));

vi.mock('./resend-email.service', () => ({
  ResendEmailService: class {
    constructor(config: unknown) {
      ResendCtor(config);
    }
  },
}));

interface ProvidedFactory {
  provide: unknown;
  inject: unknown[];
  useFactory: (config: ConfigService) => EmailService;
}

function provider(configured: string | undefined): EmailService {
  const config = {
    get: (key: string) => (key === 'email.provider' ? configured : undefined),
  } as unknown as ConfigService;

  const [provided] = (EmailModule.register().providers ?? []) as ProvidedFactory[];
  // Destructured under another name: `useFactory(...)` reads as a React hook
  // call to the linter, which is a rule this file has no business suppressing.
  const { useFactory: build } = provided;

  return build(config);
}

describe('EmailModule.register', () => {
  it('provides and exports the abstract service, built from ConfigService', () => {
    // Consumers inject `EmailService`. Binding the concrete class instead would
    // make every injection site depend on the deployment's provider choice.
    const module = EmailModule.register();
    const [provided] = (module.providers ?? []) as ProvidedFactory[];

    expect(module.exports).toEqual([EmailService]);
    expect(provided.provide).toBe(EmailService);
    expect(provided.inject).toEqual([ConfigService]);
  });

  it('selects nodemailer when configured', () => {
    provider('nodemailer');

    expect(NodemailerCtor).toHaveBeenCalled();
  });

  it('selects resend when configured', () => {
    provider('resend');

    expect(ResendCtor).toHaveBeenCalled();
  });

  // A self-hoster with no SMTP or Resend key must still boot, and a typo in
  // `EMAIL_PROVIDER` must not take the app down: logging the email is the
  // honest fallback, and the startup capability log is where the operator
  // learns delivery is off.
  it.each([
    ['nothing is configured', undefined],
    ['the provider is empty', ''],
    ['the provider name is unrecognised', 'sendgrid'],
  ])('falls back to the console provider when %s', (_label, configured) => {
    expect(provider(configured)).toBeInstanceOf(ConsoleEmailService);
  });
});
