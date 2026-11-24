import { Glass } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Play } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRunNow } from '../hooks/use-run-now';

/**
 * Run now, in the glass at the foot of an automation's page: a run starts
 * whether or not it is paused. While the request is out the button turns
 * its glyph into a spinner; once the run has started it says so for a few
 * seconds, then reads Run now again.
 */
export function RunNow({
  automationId,
  onHeight,
}: {
  automationId: string;
  onHeight: (height: number) => void;
}) {
  const { t } = useTranslation();
  const run = useRunNow(automationId);

  return (
    <View
      className="absolute inset-x-0 bottom-0 px-3 pb-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      <Glass className="gap-2 rounded-[28px] p-2">
        <Pressable
          onPress={run.start}
          disabled={run.pending}
          accessibilityRole="button"
          accessibilityState={{ busy: run.pending, disabled: run.pending }}
          className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary active:opacity-80 disabled:opacity-60"
        >
          {run.pending ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={Play} size={16} className="text-primary-foreground" />
          )}
          <Text className="text-[17px] font-medium text-primary-foreground">
            {run.started ? t('automations.mobile.started') : t('automations.detail.runNow')}
          </Text>
        </Pressable>
        {run.failed ? (
          <Text variant="caption" tone="destructive" className="px-3 pb-1 text-center">
            {t('automations.mobile.runFailed')}
          </Text>
        ) : null}
      </Glass>
    </View>
  );
}
