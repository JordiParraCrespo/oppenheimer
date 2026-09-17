import { Badge, Button } from '@oppenheimer/design-system-web';
import type { ApiTokenEntity } from '@oppenheimer/frontend-consumer';
import { dateFormatter, RowControl, SectionRow, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** One API key on the settings card: name, masked prefix, dates, status, revoke. */
export function ApiTokenRow({
  token,
  revoking,
  onRevoke,
}: {
  token: ApiTokenEntity;
  revoking: boolean;
  onRevoke: (id: string) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const date = dateFormatter(locale, { dateStyle: 'medium' });

  return (
    <SectionRow>
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-ink-900">{token.name}</div>
        <div className="mt-1.5 flex items-center gap-2 font-mono text-[12.5px] tracking-wide text-ink-600">
          {/* Only the prefix survives creation — the rest of the secret is
              stored as a digest, so the dots stand for what nobody can
              read back, not for something being hidden. */}
          <span className="truncate">{token.prefix}••••••••••••••••••</span>
        </div>
        <div className="mt-[7px] text-xs text-ink-400">
          {t('settings.api.keyCreated', {
            created: date.format(token.createdAt),
            used: token.lastUsedAt ? date.format(token.lastUsedAt) : t('settings.api.neverUsed'),
          })}
        </div>
      </div>
      <RowControl>
        <TokenStatus token={token} />
        {token.isActive && (
          <Button variant="ghost" size="sm" disabled={revoking} onClick={() => onRevoke(token.id)}>
            {t('settings.api.revoke')}
          </Button>
        )}
      </RowControl>
    </SectionRow>
  );
}

function TokenStatus({ token }: { token: ApiTokenEntity }) {
  const { t } = useTranslation();

  if (token.status === 'revoked') return <Badge variant="ended">{t('settings.api.revoked')}</Badge>;
  if (token.status === 'expired')
    return <Badge variant="paused">{t('settings.api.expired')}</Badge>;
  return null;
}
