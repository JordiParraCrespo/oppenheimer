import { Badge } from '@oppenheimer/design-system-web';
import type { ApiTokenEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { TOKEN_STATUS_LABEL, TOKEN_STATUS_VARIANT } from '@/features/api-tokens/lib/token-status';

export function TokenStatusBadge({ status }: { status: ApiTokenEntity['status'] }) {
  const { t } = useTranslation();

  return <Badge variant={TOKEN_STATUS_VARIANT[status]}>{t(TOKEN_STATUS_LABEL[status])}</Badge>;
}
