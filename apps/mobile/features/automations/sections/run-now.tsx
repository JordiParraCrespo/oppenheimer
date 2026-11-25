import { Glass } from '@oppenheimer/design-system-mobile';
import { HeroAction } from '@oppenheimer/design-system-mobile/hero-action';
import { Play } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useRunNow } from '../hooks/use-run-now';

const PLAY_SYMBOL = require('../../../assets/symbols/play_arrow.xml');

/**
 * Run now, the automation page's one primary action, floating at its foot:
 * Material 3 Expressive's extended FAB on Android, a pill in Liquid Glass on
 * iOS. A run starts whether or not it is paused. While the request is out
 * the glyph turns into a loading indicator; once the run has started it says
 * so for a few seconds, then reads Run now again.
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
      className="absolute inset-x-0 bottom-0 items-end gap-2 px-3 pb-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      {run.failed ? (
        <Glass className="self-stretch rounded-2xl px-3 py-2">
          <Text variant="caption" tone="destructive" className="text-center">
            {t('automations.mobile.runFailed')}
          </Text>
        </Glass>
      ) : null}
      <HeroAction
        label={run.started ? t('automations.mobile.started') : t('automations.detail.runNow')}
        onPress={run.start}
        busy={run.pending}
        icon={Play}
        materialIcon={PLAY_SYMBOL}
      />
    </View>
  );
}
