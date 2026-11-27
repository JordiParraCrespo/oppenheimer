import { Button, InboxMessage, InboxMessageBody } from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { useInboxSlot } from '@/features/inbox/hooks/use-inbox-slot';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxReplyHere } from '@/features/inbox/sections/inbox-reply-here';

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
  const chat = useInboxSlot('bot');
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
      <InboxReplyHere
        id={`inbox-bot-chat-${item.key}`}
        slot={chat ? () => chat(botId) : null}
        open={replying}
        onOpenChange={setReplying}
        labels={{
          reply: t('inbox.botNotice.reply'),
          hide: t('inbox.botNotice.hideReply'),
          pane: t('inbox.botNotice.chat', { bot: copy.sender }),
        }}
        link={
          <Button variant="secondary" render={<Link to="/bots/$botId" params={{ botId }} />}>
            {t('inbox.botNotice.openChat')}
          </Button>
        }
        className="overflow-y-auto bg-chat-ground"
      />
    </InboxMessage>
  );
}
