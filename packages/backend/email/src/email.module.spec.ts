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
  useFactory: (config: ConfigService) => EmailService;
  inject: unknown[];
}

/** The single provider `register()` declares, without an unchecked index. */
function providersOf(): ProvidedFactory[] {
  const module = EmailModule.register();
  return (module.providers ?? []) as ProvidedFactory[];
}

function provider(configured: string | undefined) {
  const config = {
    get: (key: string) => (key === 'email.provider' ? configured : undefined),
  } as unknown as ConfigService;

  const [provided] = providersOf();
  // Destructured under another name: `useFactory(...)` reads as a React hook
  // call to the linter, which is a rule this file has no business suppressing.
  const { useFactory: build, inject } = provided;

  return { instance: build(config), inject };
}

describe('EmailModule.register', () => {
  it('provides and exports the abstract service as the token', () => {
    // Consumers inject `EmailService`. Binding the concrete class instead would
    // make every injection site depend on the deployment's provider choice.
    const module = EmailModule.register();
    const [provided] = providersOf();

    expect(module.exports).toEqual([EmailService]);
    expect(provided.provide).toBe(EmailService);
  });

  it('injects ConfigService into the factory', () => {
    expect(provider('console').inject).toEqual([ConfigService]);
  });

  it('selects nodemailer when configured', () => {
    provider('nodemailer');

    expect(NodemailerCtor).toHaveBeenCalled();
  });

  it('selects resend when configured', () => {
    provider('resend');

    expect(ResendCtor).toHaveBeenCalled();
  });

  it('defaults to the console provider when nothing is configured', () => {
    // A self-hoster with no SMTP or Resend key must still boot. Logging the
    // email is the honest fallback; throwing at startup would make email
    // configuration mandatory for a deployment that does not send any.
    expect(provider(undefined).instance).toBeInstanceOf(ConsoleEmailService);
  });

  it('falls back to console for an unrecognised provider name', () => {
    // A typo in `EMAIL_PROVIDER` reaches this branch. Falling through to the
    // console service keeps the app up, and the startup capability log is where
    // the operator learns email delivery is off.
    expect(provider('sendgrid').instance).toBeInstanceOf(ConsoleEmailService);
  });

  it('treats an empty provider string as unset', () => {
    expect(provider('').instance).toBeInstanceOf(ConsoleEmailService);
  });
});
