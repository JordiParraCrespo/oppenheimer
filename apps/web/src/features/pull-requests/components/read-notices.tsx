import { Callout } from '@oppenheimer/design-system-web';
import type { UnreadableRepository } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * What a read could not show, said where the reader looks (#244): checks
 * GitHub refused for want of a permission the reader can grant, and each
 * watched repository it answered only in part or not at all.
 */
export function ReadNotices({
  unreadable,
  checksRefused,
}: {
  unreadable: readonly UnreadableRepository[];
  checksRefused: boolean;
}) {
  const { t } = useTranslation();
  if (!checksRefused && unreadable.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {checksRefused ? (
        <Callout tone="warning">{t('pullRequests.notices.checksRefused')}</Callout>
      ) : null}
      {unreadable.map((repository) => (
        <Callout
          key={repository.fullName}
          tone={repository.refusal === 'rate_limited' ? 'neutral' : 'warning'}
        >
          {t(
            repository.partial
              ? `pullRequests.notices.partial.${repository.refusal}`
              : `pullRequests.notices.unreadable.${repository.refusal}`,
            { name: repository.fullName },
          )}
        </Callout>
      ))}
    </div>
  );
}
