import { useExportBotConversation } from '@oppenheimer/frontend-consumer/react';
import { formatDateTime, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import {
  type ChatExportWords,
  chatExportChunk,
  chatExportFilename,
  chatExportHeader,
} from '../lib/chat-export';

/** Hands the browser a file to save, through a link to it clicked once. */
function saveFile(filename: string, file: Blob): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // The click has handed the file to the browser; the address is not needed after it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Export (Settings → Profile): the whole chat streamed from the API, each
 * message written as its Markdown piece as it arrives, in the reader's
 * language and time zone, and saved as `<bot-name>-chat-<yyyy-mm-dd>.md`.
 * The messages are never held together; the finished file is, as the `Blob`
 * the download needs.
 */
export function useExportChat(botId: string, botName: string) {
  const { t } = useTranslation();
  const locale = useLocale();
  const read = useExportBotConversation({
    onSuccess: (file) => saveFile(chatExportFilename(botName, new Date()), file),
  });
  return {
    exportChat: () => {
      const words: ChatExportWords = {
        botName,
        formatTime: (date) => formatDateTime(date, locale),
        t,
      };
      read.mutate({
        id: botId,
        header: chatExportHeader(words, new Date()),
        chunk: (message) => chatExportChunk(message, words),
        type: 'text/markdown;charset=utf-8',
      });
    },
    pending: read.isPending,
    error: read.error,
    reset: () => read.reset(),
  };
}
