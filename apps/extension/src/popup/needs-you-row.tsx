import { InboxItem } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { reasonText } from '@/i18n/translator';
import { sessionUrl } from '@/sessions/links';
import type { TrackedSession } from '@/sessions/session';
import { age } from './age';
import { TeleportButton } from './teleport-button';

/**
 * A session that needs you, as the Inbox draws an item: the session, what it
 * asks of you under it, and its repository. One waiting on an answer is
 * unread (the dot); a failed one says so before its reason.
 */
export function NeedsYouRow({ session, now }: { session: TrackedSession; now: number }) {
  const { t } = useTranslation();
  const reason = reasonText(t, session.reason) ?? t(`state.${session.state}`);
  const failed = session.state === 'failed';

  return (
    <InboxItem
      sender={session.title}
      title={failed && session.reason ? `${t('state.failed')} · ${reason}` : reason}
      preview={session.repo ?? undefined}
      meta={age(session.updatedAt, now)}
      unread={!failed}
      onClick={() => {
        void chrome.tabs.create({ url: sessionUrl(session.id) });
        window.close();
      }}
      action={<TeleportButton sessionId={session.id} />}
    />
  );
}
