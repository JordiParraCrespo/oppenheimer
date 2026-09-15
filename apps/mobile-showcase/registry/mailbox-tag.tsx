import { MailboxChip, MailboxTag } from '@oppenheimer/design-system-mobile/mailbox-tag';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function MailboxTagScreen() {
  const [chips, setChips] = React.useState(['hello@acme.com', 'sales@globex.io']);

  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Tag</Text>
        <View className="flex-row flex-wrap gap-2">
          <MailboxTag>hello@acme.com</MailboxTag>
          <MailboxTag tone="#12B5CE">support@acme.com</MailboxTag>
          <MailboxTag tone="#EF3A6B">sales@globex.io</MailboxTag>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Chip</Text>
        <View className="flex-row flex-wrap gap-2">
          {chips.map((chip) => (
            <MailboxChip
              key={chip}
              tone="#2F80F6"
              onRemove={() => setChips((current) => current.filter((entry) => entry !== chip))}
            >
              {chip}
            </MailboxChip>
          ))}
          {chips.length === 0 ? <Text className="text-sm text-ink-400">No filter</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
