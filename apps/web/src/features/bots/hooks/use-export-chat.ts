import { useExportBotConversation } from '@oppenheimer/frontend-consumer/react';
import { formatDateTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { chatExportFilename, chatExportMarkdown } from '../lib/chat-export';

/** Hands the browser a text file to save, through a link to it clicked once. */
function saveTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // The click has handed the file to the browser; the address is not needed after it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Export (Settings → Profile): the whole chat read once, written as Markdown
 * in the reader's language and time zone, and saved as
 * `<bot-name>-chat-<yyyy-mm-dd>.md`.
 */
export function useExportChat(botId: string, botName: string) {
  const { t } = useTranslation();
  const locale = useLocale();
  const read = useExportBotConversation({
    onSuccess: (messages) => {
      const now = new Date();
      saveTextFile(
        chatExportFilename(botName, now),
        chatExportMarkdown({
          botName,
          messages,
          exportedAt: now,
          formatTime: (date) => formatDateTime(date, locale),
          t,
        }),
      );
    },
  });
  return {
    exportChat: () => read.mutate(botId),
    pending: read.isPending,
    error: read.error,
    reset: () => read.reset(),
  };
}
