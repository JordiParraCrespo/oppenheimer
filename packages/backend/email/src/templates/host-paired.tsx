import type { HostPairedEmailParams } from '../email.service';
import { ActionEmail } from './action-email';

export function HostPairedEmail(params: HostPairedEmailParams) {
  return <ActionEmail {...params} />;
}
