import {
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { useBotChatSlot } from '@/features/inbox/hooks/use-bot-chat-slot';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';

/**
 * A line a bot sent you (its `notify` tool): its words as the body, and two
 * ways to answer it. Reply here opens the bot's chat on the card, the last of
 * the conversation over its composer, so you read what led to the line and
 * answer without leaving the inbox; Open chat goes to the bot's page. The
 * dock's Done is the answer when there is nothing to say — a notice asks
 * nothing of the bot, only that you saw it.
 */
export function InboxBotNoticeCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'botNotice' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const chat = useBotChatSlot();
  const [replying, setReplying] = useState(false);
  const botId = item.notice.botId;
  return (
    <InboxMessage
      icon={<InboxKindIcon kind="botNotice" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      <InboxMessageActions>
        {chat ? (
          <Button
            variant="secondary"
            aria-expanded={replying}
            aria-controls={`inbox-bot-chat-${item.key}`}
            onClick={() => setReplying((open) => !open)}
          >
            {replying ? t('inbox.botNotice.hideReply') : t('inbox.botNotice.reply')}
          </Button>
        ) : null}
        <Button variant="secondary" render={<Link to="/bots/$botId" params={{ botId }} />}>
          {t('inbox.botNotice.openChat')}
        </Button>
      </InboxMessageActions>
      {/* The transcript scrolls in its own pane; a question, an approval and
          the composer stand under it at their own height. Taller than the
          panel (a question of four options on a phone), the panel scrolls,
          so none of them is cut off. */}
      {chat && replying ? (
        <section
          id={`inbox-bot-chat-${item.key}`}
          aria-label={t('inbox.botNotice.chat', { bot: copy.sender })}
          data-swipe-ignore
          className="flex h-120 max-h-[70dvh] flex-col overflow-y-auto rounded-lg border border-border-subtle bg-chat-ground"
        >
          {chat(botId)}
        </section>
      ) : null}
    </InboxMessage>
  );
}
