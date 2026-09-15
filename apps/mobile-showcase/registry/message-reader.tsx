import { Avatar, AvatarFallback } from '@oppenheimer/design-system-mobile/avatar';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Download, FileText, User } from '@oppenheimer/design-system-mobile/icons';
import { MailboxTag } from '@oppenheimer/design-system-mobile/mailbox-tag';
import {
  MessageAttachment,
  MessageReader,
  MessageReaderBody,
  MessageReaderHeader,
  MessageReaderIdentity,
  MessageReaderLink,
  MessageReaderMeta,
  MessageReaderSubject,
} from '@oppenheimer/design-system-mobile/message-reader';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { ScrollView } from 'react-native';

export default function MessageReaderScreen() {
  return (
    <ScrollView contentContainerClassName="p-6">
      <MessageReader>
        <MessageReaderHeader>
          <MessageReaderSubject>Re: Q3 keyword plan</MessageReaderSubject>
          <MessageReaderMeta>
            <Avatar alt="Ana Costa" className="size-9">
              <AvatarFallback>
                <Text>A</Text>
              </AvatarFallback>
            </Avatar>
            <MessageReaderIdentity name="Ana Costa" address="ana@example.com" />
            <MailboxTag>hello@acme.com</MailboxTag>
            <Text className="text-xs text-ink-400">09:12</Text>
          </MessageReaderMeta>
        </MessageReaderHeader>
        <MessageReaderBody>
          <Text>Hi — attached the revised keyword list.</Text>
          <Text>
            The long-tail cluster moved up after last week's numbers; the head terms are unchanged.
            Let me know if you want the pricing page ones split out.
          </Text>
          <Text>Ana</Text>
        </MessageReaderBody>
        <MessageAttachment
          icon={<Icon as={FileText} size={16} className="text-ink-600" />}
          name="q3-keywords.xlsx"
          size="48 KB"
          action={
            <Button variant="ghost" size="icon">
              <Icon as={Download} size={16} />
            </Button>
          }
        />
        <MessageReaderLink icon={<Icon as={User} size={15} className="text-ink-400" />}>
          Ana Costa · Lead
        </MessageReaderLink>
      </MessageReader>
    </ScrollView>
  );
}
