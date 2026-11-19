import { Glass } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Play } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useRunAutomation } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

/**
 * Run now, in the glass at the foot of an automation's page: a run starts
 * whether or not it is paused. One key per tap, so a retried request is the
 * same run, not a second one.
 */
export function RunNow({
  automationId,
  onHeight,
}: {
  automationId: string;
  onHeight: (height: number) => void;
}) {
  const { t } = useTranslation();
  const run = useRunAutomation();

  return (
    <View
      className="absolute inset-x-0 bottom-0 px-3 pb-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      <Glass className="gap-2 rounded-[28px] p-2">
        <Pressable
          onPress={() => run.mutate({ id: automationId, idempotencyKey: crypto.randomUUID() })}
          disabled={run.isPending}
          accessibilityRole="button"
          className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 disabled:opacity-60"
        >
          <Icon as={Play} size={16} className="text-primary-foreground" />
          <Text className="text-[17px] font-medium text-primary-foreground">
            {run.isSuccess ? t('automations.mobile.started') : t('automations.detail.runNow')}
          </Text>
        </Pressable>
        {run.isError ? (
          <Text variant="caption" tone="destructive" className="px-3 pb-1 text-center">
            {t('automations.mobile.runFailed')}
          </Text>
        ) : null}
      </Glass>
    </View>
  );
}
