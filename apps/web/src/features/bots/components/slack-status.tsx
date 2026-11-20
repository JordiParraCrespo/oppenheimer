import { dotVariants } from '@oppenheimer/design-system-web';
import type { SlackAccountEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * How the app stands, as a dot and a word: answering you, waiting for you to
 * link your Slack user, or its token refused by Slack.
 */
export function SlackStatus({ account }: { account: SlackAccountEntity }) {
  const { t } = useTranslation();
  const [state, word] = account.needsToken
    ? (['failed', 'revoked'] as const)
    : account.ownerLinked
      ? (['running', 'answering'] as const)
      : (['queued', 'notLinked'] as const);
  return (
    <span className="inline-flex items-center gap-1.5" data-state={state}>
      <span aria-hidden className={dotVariants({ state })} />
      {t(`bots.settings.slack.status.${word}`)}
    </span>
  );
}
