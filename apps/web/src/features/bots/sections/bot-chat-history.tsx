import { Button, SettingsGroup, SettingsRow } from '@oppenheimer/design-system-web';
import { useSuspenseBotHistory } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatMediumDate, useLocale } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClearChatHistoryDialog } from '@/features/bots/dialogs/clear-chat-history';
import { useExportChat } from '@/features/bots/hooks/use-export-chat';

/**
 * Chat history, on Profile: how many messages the chat holds and when the
 * newest was written, read from the chat's own query, then Export (the whole
 * chat as Markdown) and Clear history (behind a confirm). An empty chat says
 * so, and there is nothing to export or clear.
 */
export function BotChatHistory({ botId, botName }: { botId: string; botName: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: history, error } = useSuspenseBotHistory(botId);
  const exported = useExportChat(botId, botName);
  const [clearing, setClearing] = useState(false);
  const empty = history.messageCount === 0;

  return (
    <>
      <ErrorAlert error={error} fallback={t('bots.settings.loadFailed')} />
      <SettingsGroup>
        <SettingsRow
          label={
            empty || !history.lastMessageAt
              ? t('bots.settings.profile.noMessages')
              : t('bots.settings.profile.messages', {
                  count: history.messageCount,
                  date: formatMediumDate(history.lastMessageAt, locale),
                })
          }
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={empty}
            pending={exported.pending}
            pendingLabel={t('bots.settings.profile.exporting')}
            onClick={exported.exportChat}
          >
            {t('bots.settings.profile.export')}
          </Button>
          <Button variant="secondary" size="sm" disabled={empty} onClick={() => setClearing(true)}>
            {t('bots.settings.profile.clear')}
          </Button>
        </SettingsRow>
      </SettingsGroup>
      <ErrorAlert
        error={exported.error}
        fallback={t('bots.settings.profile.exportFailed')}
        onDismiss={exported.reset}
      />
      {clearing ? (
        <ClearChatHistoryDialog botId={botId} onClose={() => setClearing(false)} />
      ) : null}
    </>
  );
}
