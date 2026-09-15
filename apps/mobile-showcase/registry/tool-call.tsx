import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Globe } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  ToolCall,
  ToolCallContent,
  ToolCallIcon,
  ToolCallIndicator,
  ToolCallLabel,
  ToolCallPayload,
  ToolCallSummary,
  ToolCallTrigger,
} from '@oppenheimer/design-system-mobile/tool-call';
import { ScrollView, View } from 'react-native';

const ARGS = JSON.stringify({ status: 'active', limit: 5 }, null, 2);

export default function ToolCallScreen() {
  return (
    <ScrollView contentContainerClassName="gap-6 p-6">
      <View className="gap-2">
        <Text className="text-lg font-semibold text-foreground">Statuses</Text>
        {(['running', 'complete', 'error'] as const).map((status) => (
          <ToolCall key={status} status={status}>
            <ToolCallTrigger>
              <ToolCallIcon>
                <Icon as={Globe} size={14} />
              </ToolCallIcon>
              <ToolCallLabel>domains_list</ToolCallLabel>
              <ToolCallSummary>
                {status === 'running'
                  ? 'Listing…'
                  : status === 'error'
                    ? 'Request timed out'
                    : '5 results'}
              </ToolCallSummary>
              <ToolCallIndicator />
            </ToolCallTrigger>
            <ToolCallContent>
              <Text>Arguments</Text>
              <ToolCallPayload>{ARGS}</ToolCallPayload>
            </ToolCallContent>
          </ToolCall>
        ))}
      </View>
    </ScrollView>
  );
}
