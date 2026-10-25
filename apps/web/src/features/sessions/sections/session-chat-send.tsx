import type { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { useVoiceDictation } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ChatSendResult, SessionChatComposer } from '../components/session-chat-composer';
import type { HeldFile } from '../hooks/use-held-files';
import { useChatState } from '../hooks/use-session-chat';
import { chatVocabulary, latestModel, latestTodos, modelName } from '../lib/chat-blocks';
import type { FileHandOff } from '../lib/file-hand-off';

/**
 * Where the chat's messages leave: the composer, fed the agent's state, and
 * the way a message reaches the agent. Its files go first, one after
 * another, each pasted into the agent's prompt by the host (`upload`), then
 * the words and Enter (`SessionChat.send`), so the agent takes them as one
 * message, the way it would from its own terminal. The first file that does
 * not arrive stops the send: it and the rest stay in the composer with the
 * words, the failure is said above it, and nothing is submitted. A reader
 * with no `upload` (a guest on a shared link) sends words only.
 */
export function SessionChatSend({
  chat,
  files,
  upload,
  onSent,
}: {
  chat: Chat;
  /** The pane's hand-off of the files it catches, when this reader can send files. */
  files?: FileHandOff;
  /** Puts one file in the agent's prompt; resolves once the host has pasted its path. */
  upload?: (file: File) => Promise<void>;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const state = useChatState(chat);
  const voice = useVoiceDictation(() => chatVocabulary(chat.snapshot().turns));
  const [failure, setFailure] = useState<Error | null>(null);
  const last = state.turns.at(-1);

  function deliver(text: string, withFiles: boolean): ChatSendResult {
    chat.send(text, { withFiles });
    onSent();
    return { sent: true };
  }

  function send(text: string, held: HeldFile[]): ChatSendResult | Promise<ChatSendResult> {
    setFailure(null);
    return held.length > 0 && upload ? sendWithFiles(text, held, upload) : deliver(text, false);
  }

  async function sendWithFiles(
    text: string,
    held: HeldFile[],
    put: (file: File) => Promise<void>,
  ): Promise<ChatSendResult> {
    const landed: string[] = [];
    for (const { id, file } of held) {
      try {
        await put(file);
        landed.push(id);
      } catch (error) {
        setFailure(error instanceof Error ? error : new Error(String(error)));
        return { sent: false, landed };
      }
    }
    return deliver(text, true);
  }

  return (
    <div className="flex flex-col gap-2">
      {failure ? (
        <ErrorAlert
          error={failure}
          fallback={t('errors.fallback')}
          title={t('sessions.session.file.failedTitle')}
          onDismiss={() => setFailure(null)}
        />
      ) : null}
      <SessionChatComposer
        busy={last?.working ?? false}
        todos={last ? latestTodos(last) : null}
        model={modelName(latestModel(state.turns))}
        voice={voice}
        files={upload ? files : undefined}
        onSend={send}
        onStop={() => chat.interrupt()}
      />
    </div>
  );
}
