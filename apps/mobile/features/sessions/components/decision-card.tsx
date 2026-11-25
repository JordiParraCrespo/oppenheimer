import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { SessionDecision } from '@oppenheimer/shared/schemas/session-decision';
import { Platform, Pressable, View } from 'react-native';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/**
 * What the agent waits on, at the top of the dock, as the export draws it: a
 * question with its options numbered as the terminal numbers them, or a
 * permission with what it is for and its choices, the first one primary.
 * A question with several parts shows the one being answered (`step`); a
 * multi-select one takes several picks, then Send.
 */
export function DecisionCard({
  decision,
  step,
  picked,
  pending,
  error,
  labels,
  onPick,
  onSend,
}: {
  decision: SessionDecision;
  step: number;
  picked: readonly number[];
  pending: boolean;
  error: string | null;
  labels: { needsInput: string; needsApproval: string; send: string; sending: string };
  onPick: (index: number) => void;
  onSend: () => void;
}) {
  const question = decision.kind === 'question' ? decision.questions[step] : null;

  return (
    <View className="gap-3 px-3 pt-3">
      <View className="flex-row items-center gap-2">
        <View className="size-2 rounded-full bg-status-paused" />
        <Text variant="overline">
          {decision.kind === 'question' ? labels.needsInput : labels.needsApproval}
          {question?.header ? ` · ${question.header}` : ''}
        </Text>
      </View>
      {decision.kind === 'question' && question ? (
        <>
          <Text variant="body">{question.question}</Text>
          {question.options.map((option, index) => (
            <Pressable
              key={option.label}
              onPress={() => onPick(index)}
              disabled={pending}
              accessibilityRole={question.multiSelect ? 'checkbox' : 'button'}
              accessibilityState={{
                checked: question.multiSelect ? picked.includes(index) : undefined,
              }}
              className={cn(
                'flex-row items-center gap-3 rounded-2xl px-4 py-3 active:opacity-70',
                picked.includes(index) ? 'bg-primary' : 'bg-secondary',
              )}
            >
              <Text variant="caption" tone={picked.includes(index) ? 'inverse' : 'muted'}>
                {index + 1}
              </Text>
              <View className="flex-1">
                <Text variant="body" tone={picked.includes(index) ? 'inverse' : 'default'}>
                  {option.label}
                </Text>
                {option.description ? (
                  <Text variant="caption" tone={picked.includes(index) ? 'inverse' : 'muted'}>
                    {option.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {question.multiSelect ? (
            <Button onPress={onSend} disabled={pending || picked.length === 0}>
              <Text>{pending ? labels.sending : labels.send}</Text>
            </Button>
          ) : null}
        </>
      ) : null}
      {decision.kind === 'permission' ? (
        <>
          <Text variant="body">{decision.title}</Text>
          {decision.detail ? (
            <View className="rounded-xl bg-secondary px-3 py-2.5">
              <Text variant="caption" tone="default" style={{ fontFamily: MONO }} selectable>
                {decision.detail}
              </Text>
            </View>
          ) : null}
          {decision.options.map((option, index) => (
            <Button
              key={option.label}
              variant={index === 0 ? 'default' : 'secondary'}
              onPress={() => onPick(index)}
              disabled={pending}
            >
              <Text>{option.label}</Text>
            </Button>
          ))}
        </>
      ) : null}
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
