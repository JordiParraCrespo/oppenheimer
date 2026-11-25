import { ChatMarkdown } from '@oppenheimer/design-system-mobile/chat-markdown';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ChatTurn as Turn } from '@oppenheimer/frontend-consumer';
import { formatWorkTime } from '@oppenheimer/frontend-mobile';
import { Platform, View } from 'react-native';
import { workOf } from '../lib/turn-work';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * One turn of the session's chat: what you sent, on the right; the work the
 * agent did folded to one line ("Worked for 1m 13s · 8 steps"); then what it
 * said, as Markdown. A command the CLI answered itself shows its output.
 */
export function ChatTurn({
  turn,
  labels,
}: {
  turn: Turn;
  labels: {
    working: string;
    worked: string;
    steps: (count: number) => string;
    interrupted: string;
  };
}) {
  const work = workOf(turn);

  return (
    <View className="gap-3">
      {turn.prompt?.text ? (
        <View className="max-w-[85%] self-end rounded-2xl bg-secondary px-3.5 py-2.5">
          <Text variant="body" selectable>
            {turn.prompt.text}
          </Text>
        </View>
      ) : null}
      {work ? (
        <View className="flex-row items-center gap-1.5 self-start rounded-full bg-secondary px-3 py-1.5">
          <Text variant="caption" tone="default">
            {turn.working ? labels.working : labels.worked}
            {work.ms !== null ? ` ${formatWorkTime(work.ms)}` : ''}
          </Text>
          <Text variant="caption">· {labels.steps(work.steps)}</Text>
        </View>
      ) : null}
      {turn.steps.map((step) => {
        if (step.kind === 'reply') {
          return (
            <ChatMarkdown key={step.id} className="pr-2">
              {step.text}
            </ChatMarkdown>
          );
        }
        if (step.kind === 'output') {
          return (
            <Text
              key={step.id}
              variant="caption"
              tone={step.failed ? 'destructive' : 'muted'}
              style={{ fontFamily: MONO }}
              selectable
            >
              {step.text}
            </Text>
          );
        }
        if (step.kind === 'notice' && step.notice === 'interrupted') {
          return (
            <Text key={step.id} variant="caption">
              {labels.interrupted}
            </Text>
          );
        }
        return null;
      })}
    </View>
  );
}
