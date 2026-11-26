import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { LoadingIndicator } from '@oppenheimer/design-system-mobile/loading-indicator';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { SessionChat } from '@oppenheimer/frontend-consumer';
import { useStickToBottom } from '@oppenheimer/frontend-mobile';
import { ScrollView, View } from 'react-native';
import { useChatState } from '../hooks/use-chat-state';
import { ChatTurn } from './chat-turn';

/**
 * The session as a conversation: the turns the host reads off the agent's
 * transcript, following the newest while the reader is at the foot. The chat arrives over the same stream as
 * the terminal; until the host sends a first batch it says it is loading.
 */
export function ChatView({
  chat,
  bottomInset,
  labels,
}: {
  chat: SessionChat;
  bottomInset: number;
  labels: {
    loading: string;
    emptyTitle: string;
    emptyDescription: string;
    working: string;
    worked: string;
    steps: (count: number) => string;
    interrupted: string;
  };
}) {
  const state = useChatState(chat);
  const stick = useStickToBottom();

  if (!state.available || state.loading) {
    return (
      <View className="flex-1 items-center justify-center gap-3" aria-busy>
        <LoadingIndicator />
        <Text variant="caption">{labels.loading}</Text>
      </View>
    );
  }

  if (state.turns.length === 0) {
    return (
      <View className="flex-1 justify-center px-6">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>{labels.emptyTitle}</EmptyState.Title>
            <EmptyState.Description>{labels.emptyDescription}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView
      {...stick}
      className="flex-1"
      contentContainerClassName="gap-6 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
    >
      {state.turns.map((turn) => (
        <ChatTurn key={turn.id} turn={turn} labels={labels} />
      ))}
    </ScrollView>
  );
}
