import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { ApprovalDecisionLook } from '@oppenheimer/frontend-consumer';
import type { BotApprovalDecision } from '@oppenheimer/shared/schemas/bot';
import { Platform, View } from 'react-native';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const VARIANT = { primary: 'default', secondary: 'secondary', ghost: 'ghost' } as const;

/**
 * The card a bot waits on before a call it may not make alone, as the
 * export draws it: Needs approval and the tool, what it is about to do, the
 * command or target, then exactly the decisions the API offered, the first
 * one primary and the two after it side by side.
 */
export function ApprovalCard({
  tool,
  summary,
  detail,
  looks,
  pending,
  error,
  labels,
  onDecide,
}: {
  tool: string;
  summary: string;
  detail: string | null;
  looks: readonly ApprovalDecisionLook[];
  pending: boolean;
  error: string | null;
  labels: { needsApproval: string; decision: (look: ApprovalDecisionLook) => string };
  onDecide: (decision: BotApprovalDecision) => void;
}) {
  const [first, ...rest] = looks;
  return (
    <View className="gap-3 px-3 pt-3">
      <View className="flex-row items-center gap-2">
        <View className="size-2 rounded-full bg-status-paused" />
        <Text variant="overline">
          {labels.needsApproval} · {tool}
        </Text>
      </View>
      <Text variant="body">{summary}</Text>
      {detail ? (
        <View className="rounded-xl bg-secondary px-3 py-2.5">
          <Text
            variant="caption"
            tone="default"
            style={{ fontFamily: MONO }}
            selectable
            numberOfLines={6}
          >
            {detail}
          </Text>
        </View>
      ) : null}
      {first ? (
        <Button onPress={() => onDecide(first.decision)} disabled={pending}>
          <Text>{labels.decision(first)}</Text>
        </Button>
      ) : null}
      {rest.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {rest.map((look) => (
            <Button
              key={look.decision}
              variant={VARIANT[look.variant]}
              className="min-w-[45%] flex-1"
              onPress={() => onDecide(look.decision)}
              disabled={pending}
            >
              <Text>{labels.decision(look)}</Text>
            </Button>
          ))}
        </View>
      ) : null}
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
