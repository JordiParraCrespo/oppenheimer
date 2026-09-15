import { Button } from '@oppenheimer/design-system-mobile/button';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Paperclip } from '@oppenheimer/design-system-mobile/icons';
import { ReplyBox } from '@oppenheimer/design-system-mobile/reply-box';
import { Text } from '@oppenheimer/design-system-mobile/text';
import * as React from 'react';
import { ScrollView, View } from 'react-native';

export default function ReplyBoxScreen() {
  const [value, setValue] = React.useState('');

  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Reply</Text>
        <ReplyBox
          value={value}
          onValueChange={setValue}
          placeholder="Write a reply…"
          toolbar={
            <Button variant="ghost" size="icon">
              <Icon as={Paperclip} size={16} />
            </Button>
          }
          actions={
            <Button size="sm" disabled={value.trim() === ''}>
              <Text>Send</Text>
            </Button>
          }
        />
      </View>
    </ScrollView>
  );
}
