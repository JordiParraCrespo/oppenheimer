import type {
  EmailVerificationEmailParams,
  HostPairedEmailParams,
  InvitationEmailParams,
  PasswordResetEmailParams,
  WelcomeEmailParams,
} from '@oppenheimer/backend-email';
import type { LocalizedFormatter } from '@oppenheimer/backend-i18n';

export interface EmailLocaleTarget {
  to: string;
  /** The recipient's user id, when the producer knows it — resolves their saved locale. */
  userId: string | null;
}

/**
 * Pure queue-payload → email-template mapper.
 *
 * The processor resolves one recipient locale, binds a formatter to it, and
 * hands both to this mapper. Templates therefore receive finished copy and do
 * not depend on Nest, the translation package, or whichever delivery provider
 * happens to be active. Copy lives under `emails.*` in `packages/translations`.
 */
export class EmailJobMapper {
  toLocaleTarget(input: unknown): EmailLocaleTarget {
    const data = this.record(input);
    return { to: this.required(data, 'to'), userId: this.optional(data, 'userId') };
  }

  toPasswordReset(input: unknown, t: LocalizedFormatter): PasswordResetEmailParams {
    const data = this.record(input);
    return {
      ...this.securityFrame(t, 'passwordReset'),
      heading: t.t('emails.passwordReset.heading'),
      body: t.t('emails.passwordReset.body'),
      actionLabel: t.t('emails.passwordReset.action'),
      url: this.required(data, 'url'),
      helperText: t.t('emails.passwordReset.helper'),
      fallbackLabel: t.t('emails.common.pasteLink'),
      closingText: t.t('emails.passwordReset.closing'),
      recipientEmail: this.required(data, 'to'),
    };
  }

  toEmailVerification(input: unknown, t: LocalizedFormatter): EmailVerificationEmailParams {
    const data = this.record(input);
    return {
      ...this.securityFrame(t, 'emailVerification'),
      heading: t.t('emails.emailVerification.heading'),
      body: t.t('emails.emailVerification.body'),
      actionLabel: t.t('emails.emailVerification.action'),
      url: this.required(data, 'url'),
      helperText: t.t('emails.emailVerification.helper'),
      fallbackLabel: t.t('emails.common.pasteLink'),
      closingText: t.t('emails.emailVerification.closing'),
      recipientEmail: this.required(data, 'to'),
    };
  }

  /**
   * A machine was paired with the recipient's account. Only a prefix of the
   * fingerprint travels: enough to compare with the one on the host in
   * Settings, which is where the full value is shown.
   */
  toHostPaired(input: unknown, t: LocalizedFormatter): HostPairedEmailParams {
    const data = this.record(input);
    const vars = {
      hostName: this.required(data, 'hostName'),
      machine: this.required(data, 'machine'),
      fingerprint: this.required(data, 'fingerprint').slice(0, 16),
    };
    return {
      ...this.securityFrame(t, 'hostPaired', vars),
      heading: t.t('emails.hostPaired.heading'),
      body: t.t('emails.hostPaired.body', vars),
      actionLabel: t.t('emails.hostPaired.action'),
      url: this.required(data, 'url'),
      helperText: t.t('emails.hostPaired.helper'),
      fallbackLabel: t.t('emails.common.pasteLink'),
      closingText: t.t('emails.hostPaired.closing'),
      recipientEmail: this.required(data, 'to'),
    };
  }

  toWelcome(input: unknown, t: LocalizedFormatter): WelcomeEmailParams {
    const data = this.record(input);
    const name = this.required(data, 'name');
    return {
      ...this.frame(t, 'welcome'),
      eyebrow: t.t('emails.welcome.eyebrow'),
      heading: t.t('emails.welcome.heading'),
      greeting: t.t('emails.welcome.greeting', { name }),
      body: t.t('emails.welcome.body'),
      supportText: t.t('emails.welcome.support'),
      signoff: t.t('emails.welcome.signoff'),
    };
  }

  toInvitation(input: unknown, t: LocalizedFormatter): InvitationEmailParams {
    const data = this.record(input);
    const organizationName = this.required(data, 'organizationName');
    const inviterName = this.required(data, 'inviterName');
    const role = this.required(data, 'role');
    const vars = { organizationName, inviterName };
    const localizedRole = t.optional(`emails.invitation.roles.${role}`) ?? role;

    return {
      ...this.frame(t, 'invitation', vars),
      heroLabel: t.t('emails.invitation.hero'),
      heading: t.t('emails.invitation.heading', vars),
      body: t.t('emails.invitation.body'),
      inviterInitials: this.initials(inviterName),
      inviterLine: t.t('emails.invitation.inviterLine', vars),
      roleLine: t.t('emails.invitation.roleLine', { role: localizedRole }),
      benefitsTitle: t.t('emails.invitation.benefitsTitle'),
      benefits: [
        t.t('emails.invitation.benefitWorkspace'),
        t.t('emails.invitation.benefitCollaboration'),
        t.t('emails.invitation.benefitAccount'),
      ],
      actionLabel: t.t('emails.invitation.action'),
      url: this.required(data, 'url'),
      expiryText: t.t('emails.invitation.helper', vars),
      fallbackLabel: t.t('emails.common.pasteLink'),
      ignoreText: t.t('emails.invitation.ignore'),
    };
  }

  private frame(
    t: LocalizedFormatter,
    template: 'welcome' | 'invitation',
    vars: Record<string, string> = {},
  ) {
    return {
      locale: t.locale,
      subject: t.t(`emails.${template}.subject`, vars),
      preview: t.t(`emails.${template}.preview`, vars),
      brandName: t.t('emails.common.brandName'),
      footer: t.t('emails.common.footer'),
    };
  }

  private securityFrame(
    t: LocalizedFormatter,
    template: 'passwordReset' | 'emailVerification' | 'hostPaired',
    vars: Record<string, string> = {},
  ) {
    return {
      locale: t.locale,
      subject: t.t(`emails.${template}.subject`, vars),
      preview: t.t(`emails.${template}.preview`, vars),
      brandName: t.t('emails.common.brandName'),
      footer: `${t.t('emails.common.footer')}\n${t.t(`emails.${template}.footerNote`)}`,
    };
  }

  private initials(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  private record(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Email job data must be an object');
    }
    return input as Record<string, unknown>;
  }

  private required(data: Record<string, unknown>, key: string): string {
    const value = this.optional(data, key);
    if (!value) throw new Error(`Email job is missing ${key}`);
    return value;
  }

  private optional(data: Record<string, unknown>, key: string): string | null {
    const value = data[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
