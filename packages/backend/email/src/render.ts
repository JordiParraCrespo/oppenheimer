import { render } from '@react-email/render';
import * as React from 'react';
import type {
  EmailVerificationEmailParams,
  HostPairedEmailParams,
  InvitationEmailParams,
  PasswordResetEmailParams,
  WelcomeEmailParams,
} from './email.service';
import { EmailVerificationEmail } from './templates/email-verification';
import { HostPairedEmail } from './templates/host-paired';
import { InvitationEmail } from './templates/invitation';
import { PasswordResetEmail } from './templates/password-reset';
import { WelcomeEmail } from './templates/welcome';

export async function renderPasswordResetEmail(params: PasswordResetEmailParams): Promise<string> {
  return render(React.createElement(PasswordResetEmail, params));
}

export async function renderEmailVerificationEmail(
  params: EmailVerificationEmailParams,
): Promise<string> {
  return render(React.createElement(EmailVerificationEmail, params));
}

export async function renderWelcomeEmail(params: WelcomeEmailParams): Promise<string> {
  return render(React.createElement(WelcomeEmail, params));
}

export async function renderInvitationEmail(params: InvitationEmailParams): Promise<string> {
  return render(React.createElement(InvitationEmail, params));
}

export async function renderHostPairedEmail(params: HostPairedEmailParams): Promise<string> {
  return render(React.createElement(HostPairedEmail, params));
}
