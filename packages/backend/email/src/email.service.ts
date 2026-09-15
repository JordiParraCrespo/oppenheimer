/** Copy and presentation shared by every transactional email. */
export interface EmailFrameParams {
  /** Resolved recipient locale, used for the document's `lang` attribute. */
  locale: string;
  subject: string;
  preview: string;
  brandName: string;
  footer: string;
}

/** A transactional email whose primary purpose is opening one secure link. */
export interface ActionEmailParams extends EmailFrameParams {
  heading: string;
  body: string;
  actionLabel: string;
  url: string;
  helperText: string;
  fallbackLabel: string;
  closingText: string;
  recipientEmail?: string;
}

export type PasswordResetEmailParams = ActionEmailParams;
export type EmailVerificationEmailParams = ActionEmailParams;

export interface WelcomeEmailParams extends EmailFrameParams {
  eyebrow: string;
  heading: string;
  greeting: string;
  body: string;
  supportText: string;
  signoff: string;
}

/** Data needed to render/send an organization invitation email. */
export interface InvitationEmailParams extends EmailFrameParams {
  heroLabel: string;
  heading: string;
  body: string;
  inviterInitials: string;
  inviterLine: string;
  roleLine: string;
  benefitsTitle: string;
  benefits: readonly string[];
  actionLabel: string;
  url: string;
  expiryText: string;
  fallbackLabel: string;
  ignoreText: string;
}

export abstract class EmailService {
  abstract sendPasswordReset(to: string, params: PasswordResetEmailParams): Promise<void>;
  abstract sendEmailVerification(to: string, params: EmailVerificationEmailParams): Promise<void>;
  abstract sendWelcome(to: string, params: WelcomeEmailParams): Promise<void>;
  abstract sendInvitation(to: string, params: InvitationEmailParams): Promise<void>;
}
