import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailService,
  type EmailVerificationEmailParams,
  type InvitationEmailParams,
  type PasswordResetEmailParams,
  type WelcomeEmailParams,
} from './email.service';
import {
  renderEmailVerificationEmail,
  renderInvitationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from './render';

@Injectable()
export class NodemailerEmailService extends EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('email.smtpHost'),
      port: this.configService.get('email.smtpPort'),
      auth: {
        user: this.configService.get('email.smtpUser'),
        pass: this.configService.get('email.smtpPass'),
      },
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
}
