import type { HostNetworkChangedEmailParams } from '../email.service';
import { ActionEmail } from './action-email';

export function HostNetworkChangedEmail(params: HostNetworkChangedEmailParams) {
  return <ActionEmail {...params} />;
}
