import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { useBotLive, useSuspenseBotConversation } from '@oppenheimer/frontend-consumer/react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { TranscriptLine } from '../components/transcript-line';
import { transcriptRows } from '../lib/transcript-rows';

/**
 * A bot's chat, following the newest line: what is stored, and the words a
 * turn is writing as they stream (`useBotLive`, the same stream the console
 * reads). Under a Suspense boundary: the conversation is always there.
 */
export function BotTranscript({ botId, bottomInset }: { botId: string; bottomInset: number }) {
  const { t } = useTranslation();
  const { data: conversation } = useSuspenseBotConversation(botId);
  const live = useBotLive(botId);
  const scroller = useRef<ScrollView>(null);
  const rows = transcriptRows(conversation, live.text);

  if (rows.length === 0) {
    return (
      <View className="flex-1 justify-center px-6">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Description>{t('bots.sidebar.noMessages')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroller}
      className="flex-1"
      contentContainerClassName="gap-4 px-4 pt-4"
      contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
      onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
    >
      {rows.map((row) => (
        <TranscriptLine
          key={row.key}
          row={row}
          labels={{
            working: t('sessions.chat.turn.working'),
            worked: t('sessions.chat.turn.worked'),
            steps: (count) => t('sessions.mobile.steps', { count }),
          }}
        />
      ))}
    </ScrollView>
  );
}
