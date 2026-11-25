import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { BotQuestion } from '@oppenheimer/shared/schemas/bot';
import { Pressable, View } from 'react-native';

/**
 * A question the bot put to you, one part at a time (`step`), with its
 * options numbered; a multi-select part takes several picks, then Send.
 */
export function QuestionCard({
  question,
  picked,
  pending,
  error,
  labels,
  onPick,
  onSend,
}: {
  question: BotQuestion;
  picked: readonly number[];
  pending: boolean;
  error: string | null;
  labels: { needsInput: string; send: string; sending: string };
  onPick: (index: number) => void;
  onSend: () => void;
}) {
  return (
    <View className="gap-3 px-3 pt-3">
      <View className="flex-row items-center gap-2">
        <View className="size-2 rounded-full bg-status-paused" />
        <Text variant="overline">
          {labels.needsInput}
          {question.header ? ` · ${question.header}` : ''}
        </Text>
      </View>
      <Text variant="body">{question.question}</Text>
      {question.options.map((option, index) => {
        const on = picked.includes(index);
        return (
          <Pressable
            key={option.label}
            onPress={() => onPick(index)}
            disabled={pending}
            accessibilityRole={question.multiSelect ? 'checkbox' : 'button'}
            accessibilityState={question.multiSelect ? { checked: on } : undefined}
            className={cn(
              'flex-row items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70',
              on ? 'bg-primary' : 'bg-secondary',
            )}
          >
            <Text variant="caption" tone={on ? 'inverse' : 'muted'}>
              {index + 1}
            </Text>
            <View className="flex-1">
              <Text variant="body" tone={on ? 'inverse' : 'default'}>
                {option.label}
              </Text>
              {option.description ? (
                <Text variant="caption" tone={on ? 'inverse' : 'muted'}>
                  {option.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {question.multiSelect ? (
        <Button onPress={onSend} disabled={pending || picked.length === 0}>
          <Text>{pending ? labels.sending : labels.send}</Text>
        </Button>
      ) : null}
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
