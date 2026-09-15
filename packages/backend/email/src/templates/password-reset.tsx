import type { PasswordResetEmailParams } from '../email.service';
import { ActionEmail } from './action-email';

export function PasswordResetEmail(params: PasswordResetEmailParams) {
  return <ActionEmail {...params} />;
}
