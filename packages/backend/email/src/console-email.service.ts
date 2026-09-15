import { Injectable, Logger } from '@nestjs/common';
import {
  EmailService,
  type EmailVerificationEmailParams,
  type InvitationEmailParams,
  type PasswordResetEmailParams,
  type WelcomeEmailParams,
} from './email.service';

@Injectable()
export class ConsoleEmailService extends EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendPasswordReset(to: string, params: PasswordResetEmailParams): Promise<void> {
    this.logger.log(`[PASSWORD RESET] To: ${to} | Locale: ${params.locale} | URL: ${params.url}`);
  }

  async sendEmailVerification(to: string, params: EmailVerificationEmailParams): Promise<void> {
    this.logger.log(
      `[EMAIL VERIFICATION] To: ${to} | Locale: ${params.locale} | URL: ${params.url}`,
    );
  }

  async sendWelcome(to: string, params: WelcomeEmailParams): Promise<void> {
    this.logger.log(`[WELCOME] To: ${to} | Locale: ${params.locale}`);
  }

  async sendInvitation(to: string, params: InvitationEmailParams): Promise<void> {
    this.logger.log(`[INVITATION] To: ${to} | Locale: ${params.locale} | URL: ${params.url}`);
  }
}
