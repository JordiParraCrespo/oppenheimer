import { I18nService } from '@oppenheimer/backend-i18n';
import en from '@oppenheimer/translations/en/index.json';
import es from '@oppenheimer/translations/es/index.json';
import { describe, expect, it } from 'vitest';
import { EmailJobMapper } from '../email-job.mapper';

const i18n = new I18nService({
  bundles: { en, es },
  defaultLocale: 'en',
  defaultTimeZone: 'UTC',
  onMissingKey: () => {},
});

describe('EmailJobMapper', () => {
  const mapper = new EmailJobMapper();

  it.each(['en', 'es'])('has every transactional email key in %s', (locale) => {
    const keys = [
      'emails.common.brandName',
      'emails.common.footer',
      'emails.common.pasteLink',
      'emails.passwordReset.subject',
      'emails.passwordReset.preview',
      'emails.passwordReset.heading',
      'emails.passwordReset.body',
      'emails.passwordReset.action',
      'emails.passwordReset.helper',
      'emails.passwordReset.closing',
      'emails.passwordReset.footerNote',
      'emails.emailVerification.subject',
      'emails.emailVerification.preview',
      'emails.emailVerification.heading',
      'emails.emailVerification.body',
      'emails.emailVerification.action',
      'emails.emailVerification.helper',
      'emails.emailVerification.closing',
      'emails.emailVerification.footerNote',
      'emails.hostPaired.subject',
      'emails.hostPaired.preview',
      'emails.hostPaired.heading',
      'emails.hostPaired.body',
      'emails.hostPaired.action',
      'emails.hostPaired.helper',
      'emails.hostPaired.closing',
      'emails.hostPaired.footerNote',
      'emails.welcome.subject',
      'emails.welcome.preview',
      'emails.welcome.eyebrow',
      'emails.welcome.heading',
      'emails.welcome.greeting',
      'emails.welcome.body',
      'emails.welcome.support',
      'emails.welcome.signoff',
      'emails.invitation.subject',
      'emails.invitation.preview',
      'emails.invitation.hero',
      'emails.invitation.heading',
      'emails.invitation.body',
      'emails.invitation.inviterLine',
      'emails.invitation.roleLine',
      'emails.invitation.roles.owner',
      'emails.invitation.roles.admin',
      'emails.invitation.roles.member',
      'emails.invitation.benefitsTitle',
      'emails.invitation.benefitWorkspace',
      'emails.invitation.benefitCollaboration',
      'emails.invitation.benefitAccount',
      'emails.invitation.action',
      'emails.invitation.helper',
      'emails.invitation.ignore',
    ];

    expect(keys.filter((key) => !i18n.has(locale, key))).toEqual([]);
  });

  it('builds password reset copy in the selected Spanish locale', () => {
    const email = mapper.toPasswordReset(
      { to: 'ana@example.com', url: 'https://example.com/reset' },
      i18n.for('es'),
    );

    expect(email.locale).toBe('es');
    expect(email.subject).toBe('Restablece tu contraseña');
    expect(email.actionLabel).toBe('Restablecer contraseña');
    expect(email.recipientEmail).toBe('ana@example.com');
    expect(email.footer).toContain('Este es un correo de seguridad');
  });

  it('localizes invitation copy and the selected organization role', () => {
    const email = mapper.toInvitation(
      {
        to: 'ana@example.com',
        organizationName: 'Acme',
        inviterName: 'Adri Rodrigo',
        role: 'member',
        url: 'https://example.com/invite',
      },
      i18n.for('es'),
    );

    expect(email.subject).toBe('Te han invitado a Acme');
    expect(email.heading).toBe('Únete al espacio Acme');
    expect(email.roleLine).toBe('Te unirás como Miembro');
    expect(email.inviterInitials).toBe('AR');
    expect(email.benefits).toHaveLength(3);
  });

  it('passes an organization role the bundle does not name through verbatim', () => {
    const email = mapper.toInvitation(
      {
        to: 'ana@example.com',
        organizationName: 'Acme',
        inviterName: 'Adri',
        role: 'editor',
        url: 'https://example.com/invite',
      },
      i18n.for('en'),
    );

    expect(email.roleLine).toBe('Joining as editor');
  });

  it('rejects malformed internal jobs instead of sending partial mail', () => {
    expect(() => mapper.toLocaleTarget({ userId: 'user-1' })).toThrow('Email job is missing to');
  });

  it('writes the new-host notice with the machine and only a prefix of its fingerprint', () => {
    const params = mapper.toHostPaired(
      {
        to: 'jordi@example.com',
        userId: 'u1',
        hostName: 'Dev box',
        machine: 'devbox.local, macos',
        fingerprint: 'abcdef0123456789'.repeat(4),
        url: 'https://app.oppenheimer.dev',
      },
      i18n.for('en', 'UTC'),
    );

    expect(params.subject).toBe('A new machine was paired with your account');
    expect(params.body).toContain('Dev box (devbox.local, macos)');
    expect(params.body).toContain('abcdef0123456789');
    expect(params.body).not.toContain('abcdef0123456789abcdef');
    expect(params.url).toBe('https://app.oppenheimer.dev');
    // A security email: the footer says why it cannot be turned off.
    expect(params.footer).toContain('security email');
  });
});
