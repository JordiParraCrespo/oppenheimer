import { Button } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import { ChatMailMessage } from '@oppenheimer/frontend-web';
import type { BotMailDraft } from '@oppenheimer/shared/schemas/mail';
import { useTranslation } from 'react-i18next';

/**
 * A draft the bot saved in your Gmail (`product/next-steps/mail.md` §3.3),
 * under the call that saved it: the message as written, that nothing was
 * sent, and Open in Gmail, where you edit it or send it yourself.
 */
export function BotMailDraftCard({ draft }: { draft: BotMailDraft }) {
  const { t } = useTranslation();
  return (
    <ChatMailMessage mail={draft.mail}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs text-fg-subtle">
          {t(
            draft.saved === 'created'
              ? 'common.chat.mail.draftSaved'
              : 'common.chat.mail.draftUpdated',
            { email: draft.mail.accountEmail },
          )}
        </p>
        <Button
          variant="secondary"
          size="xs"
          nativeButton={false}
          render={<a href={draft.link} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink />
          {t('common.chat.mail.openInGmail')}
        </Button>
      </div>
    </ChatMailMessage>
  );
}
