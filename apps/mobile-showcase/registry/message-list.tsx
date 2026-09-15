import { Avatar, AvatarFallback } from '@oppenheimer/design-system-mobile/avatar';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Paperclip } from '@oppenheimer/design-system-mobile/icons';
import { MailboxTag } from '@oppenheimer/design-system-mobile/mailbox-tag';
import { MessageList, MessageListItem } from '@oppenheimer/design-system-mobile/message-list';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { View } from 'react-native';

const MESSAGES = [
  {
    id: '1',
    from: 'Ana Costa',
    subject: 'Re: Q3 keyword plan',
    preview: 'Attached the revised list — the long-tail cluster moved up.',
    time: '09:12',
    unread: true,
    attachment: true,
  },
  {
    id: '2',
    from: 'Ben Okafor',
    subject: 'Backlink outreach results',
    preview: '14 replies, 3 placements confirmed so far.',
    time: 'Yesterday',
    unread: false,
    attachment: false,
  },
  {
    id: '3',
    from: 'Chloé Martin',
    subject: 'Site migration checklist',
    preview: 'Can we confirm the redirect map before Friday?',
    time: 'Mon',
    unread: true,
    attachment: false,
  },
];

export default function MessageListScreen() {
  const [selected, setSelected] = React.useState<string | null>('2');

  return (
    <View className="flex-1 bg-surface-canvas">
      <MessageList>
        {MESSAGES.map((message) => (
          <MessageListItem
            key={message.id}
            avatar={
              <Avatar alt={message.from} className="size-9">
                <AvatarFallback>
                  <Text>{message.from[0]}</Text>
                </AvatarFallback>
              </Avatar>
            }
            from={message.from}
            tag={<MailboxTag>hello@acme.com</MailboxTag>}
            subject={message.subject}
            preview={message.preview}
            time={message.time}
            indicators={message.attachment ? <Icon as={Paperclip} size={13} /> : undefined}
            unread={message.unread}
            selected={selected === message.id}
            onPress={() => setSelected(message.id)}
          />
        ))}
      </MessageList>
    </View>
  );
}
