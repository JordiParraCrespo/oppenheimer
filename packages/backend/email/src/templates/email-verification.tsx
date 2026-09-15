import type { EmailVerificationEmailParams } from '../email.service';
import { ActionEmail } from './action-email';

export function EmailVerificationEmail(params: EmailVerificationEmailParams) {
  return <ActionEmail {...params} />;
}
