import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailService,
  type EmailVerificationEmailParams,
  type HostNetworkChangedEmailParams,
  type HostPairedEmailParams,
  type InvitationEmailParams,
  type PasswordResetEmailParams,
  type WelcomeEmailParams,
} from './email.service';
import {
  renderEmailVerificationEmail,
  renderHostNetworkChangedEmail,
  renderHostPairedEmail,
  renderInvitationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from './render';

@Injectable()
export class NodemailerEmailService extends EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    super();
    const port = this.configService.get<number>('email.smtpPort');
    const user = this.configService.get<string>('email.smtpUser');
    const pass = this.configService.get<string>('email.smtpPass');
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('email.smtpHost'),
      port,
      // 465 speaks TLS from the first byte; other ports upgrade with STARTTLS
      // when the server offers it.
      secure: port === 465,
      // A relay that trusts the sender's network takes no credentials, and
      // blank ones would make nodemailer try to log in anyway.
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  async sendPasswordReset(to: string, params: PasswordResetEmailParams): Promise<void> {
    const html = await renderPasswordResetEmail(params);
    await this.transporter.sendMail({
      from: this.configService.get('email.from'),
      to,
      subject: params.subject,
      html,
    });
  }

  async sendEmailVerification(to: string, params: EmailVerificationEmailParams): Promise<void> {
    const html = await renderEmailVerificationEmail(params);
    await this.transporter.sendMail({
      from: this.configService.get('email.from'),
      to,
      subject: params.subject,
      html,
    });
  }

  async sendWelcome(to: string, params: WelcomeEmailParams): Promise<void> {
    const html = await renderWelcomeEmail(params);
    await this.transporter.sendMail({
      from: this.configService.get('email.from'),
      to,
      subject: params.subject,
      html,
    });
  }

  async sendInvitation(to: string, params: InvitationEmailParams): Promise<void> {
    const html = await renderInvitationEmail(params);
    await this.transporter.sendMail({
      from: this.configService.get('email.from'),
      to,
      subject: params.subject,
      html,
    });
  }

  async sendHostPaired(to: string, params: HostPairedEmailParams): Promise<void> {
    const html = await renderHostPairedEmail(params);
    await this.transporter.sendMail({
      from: this.configService.get('email.from'),
      to,
      subject: params.subject,
      html,
    });
  }

  async sendHostNetworkChanged(to: string, params: HostNetworkChangedEmailParams): Promise<void> {
    const html = await renderHostNetworkChangedEmail(params);
    await this.transporter.sendMail({
      from: this.configService.get('email.from'),
      to,
      subject: params.subject,
      html,
    });
  }
}
