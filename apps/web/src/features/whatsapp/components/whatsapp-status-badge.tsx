import { Badge } from '@oppenheimer/design-system-web';
import type { WhatsappAccountStatus } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

const VARIANT = {
  connected: 'active',
  connecting: 'paused',
  pairing: 'draft',
  logged_out: 'ended',
  unlinked: 'ended',
} as const satisfies Record<WhatsappAccountStatus, string>;

/** How the device stands; a host that is offline says that instead, since nothing moves until it is back. */
export function WhatsappStatusBadge({
  status,
  hostOnline,
}: {
  status: WhatsappAccountStatus;
  hostOnline: boolean;
}) {
  const { t } = useTranslation();
  if (!hostOnline) return <Badge variant="neutral">{t('settings.whatsapp.hostOffline')}</Badge>;
  return <Badge variant={VARIANT[status]}>{t(`settings.whatsapp.status.${status}`)}</Badge>;
}
