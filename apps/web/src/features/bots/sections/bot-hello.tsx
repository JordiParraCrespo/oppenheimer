import { ChatReply, ChatTranscript, MessageTrail } from '@oppenheimer/design-system-web';
import { useBotDocuments } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';

/**
 * The bot's first message, before there is a conversation: a bot with no
 * instructions asks for the job and says it will write its own from it; one
 * that has them greets the reader by its name. Which it is depends on the
 * instructions, so this reads them (narrowed to "are they blank?") and draws
 * nothing until it knows, rather than greeting one way and switching. A read
 * that fails greets the plain way: the hello is a courtesy, not a fact the
 * reader acts on.
 */
export function BotHello({
  botId,
  name,
  modelLabel,
}: {
  botId: string;
  name: string;
  modelLabel: string | null;
}) {
  const { t } = useTranslation();
  const { data: blank, isPending } = useBotDocuments(botId, {
    select: (documents) => documents.find((document) => document.name === 'instructions')?.isBlank,
  });
  if (isPending) return null;

  return (
    <ChatTranscript>
      <div className="flex flex-col gap-2">
        <ChatReply>
          <p>{blank ? t('bots.chat.helloBlank') : t('bots.chat.hello', { name })}</p>
        </ChatReply>
        {modelLabel ? <MessageTrail meta={modelLabel} /> : null}
      </div>
    </ChatTranscript>
  );
}
