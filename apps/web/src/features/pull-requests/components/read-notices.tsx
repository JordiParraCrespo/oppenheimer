import { Callout } from '@oppenheimer/design-system-web';
import type { UnreadableRepository } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * What a read could not show (#244): one line for each repository, part and
 * refusal GitHub gave. Checks refused for want of access also say which App
 * permissions to grant, since that is the one a reader can fix.
 */
export function ReadNotices({ unreadable }: { unreadable: readonly UnreadableRepository[] }) {
  const { t } = useTranslation();
  if (unreadable.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {unreadable.map((gap) => (
        <Callout
          key={`${gap.fullName}|${gap.what}|${gap.refusal}`}
          tone={gap.refusal === 'rate_limited' ? 'neutral' : 'warning'}
        >
          {t(`pullRequests.notices.${gap.refusal}`, {
            name: gap.fullName,
            what: t(`pullRequests.notices.what.${gap.what}`),
          })}
          {gap.what === 'checks' && gap.refusal === 'forbidden'
            ? ` ${t('pullRequests.notices.checksPermission')}`
            : null}
        </Callout>
      ))}
    </div>
  );
}
