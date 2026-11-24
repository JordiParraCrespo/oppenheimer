import { useSendBotMessage } from '@oppenheimer/frontend-consumer/bots';
import { useState } from 'react';

/**
 * The bot composer's draft and its send. The draft clears as soon as the
 * person sends, so the box is ready for the next message while the first one
 * is on its way.
 */
export function useBotReply(botId: string) {
  const [draft, setDraft] = useState('');
  const send = useSendBotMessage(botId);

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    send.mutate({ content });
  };

  return { draft, setDraft, submit, sending: send.isPending };
}
