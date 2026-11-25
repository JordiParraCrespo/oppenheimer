import { ChatMarkdown } from '@oppenheimer/design-system-mobile/chat-markdown';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { formatWorkTime } from '@oppenheimer/frontend-mobile';
import { View } from 'react-native';
import type { TranscriptRow } from '../lib/transcript-rows';

/** One line of a bot's chat: your message on the right, its words, a folded run of work, or an event. */
export function TranscriptLine({
  row,
  labels,
}: {
  row: TranscriptRow;
  labels: { working: string; worked: string; steps: (count: number) => string };
}) {
  if (row.kind === 'you') {
    return (
      <View className="max-w-[85%] self-end rounded-2xl bg-secondary px-3.5 py-2.5">
        <Text variant="body" selectable>
          {row.text}
        </Text>
      </View>
    );
  }
  if (row.kind === 'reply') return <ChatMarkdown className="pr-2">{row.text}</ChatMarkdown>;
  if (row.kind === 'work') {
    return (
      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-secondary px-3 py-1.5">
        <Text variant="caption" tone="default">
          {row.working ? labels.working : labels.worked}
          {row.ms !== null ? ` ${formatWorkTime(row.ms)}` : ''}
        </Text>
        <Text variant="caption">· {labels.steps(row.steps)}</Text>
      </View>
    );
  }
  return (
    <Text variant="caption" className="text-center">
      {row.text}
    </Text>
  );
}
