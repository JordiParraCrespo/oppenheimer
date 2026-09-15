import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Globe, Inbox } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { ScrollView, View } from 'react-native';

export default function EmptyStateScreen() {
  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Icon</Text>
        <View className="rounded-2xl border border-border-subtle bg-card">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Icon as={Globe} size={24} />
              </EmptyState.Media>
              <EmptyState.Title>No domains yet</EmptyState.Title>
              <EmptyState.Description>
                Domains you track will appear here once they are added.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <Button size="sm">
                <Text>Add a domain</Text>
              </Button>
            </EmptyState.Content>
          </EmptyState>
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Plain</Text>
        <View className="rounded-2xl border border-border-subtle bg-card">
          <EmptyState>
            <EmptyState.Header>
              <EmptyState.Media>
                <Icon as={Inbox} size={32} className="text-ink-400" />
              </EmptyState.Media>
              <EmptyState.Title>Inbox zero</EmptyState.Title>
              <EmptyState.Description>Nothing needs your attention.</EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        </View>
      </View>
    </ScrollView>
  );
}
