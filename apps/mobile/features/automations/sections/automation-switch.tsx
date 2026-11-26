import { Switch } from '@oppenheimer/design-system-mobile/switch';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useSetAutomationPaused } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

/**
 * The system's switch that pauses or resumes one automation: on while it
 * listens, off while paused. It shows the change at once and settles on the
 * answer; a refusal puts it back and says so.
 */
export function AutomationSwitch({ automation }: { automation: AutomationEntity }) {
  const { t } = useTranslation();
  const pause = useSetAutomationPaused({
    onError: () => Alert.alert(t('automations.mobile.pauseFailed')),
  });
  const on = pause.isPending ? !pause.variables.paused : !automation.isPaused;

  return (
    <Switch
      checked={on}
      disabled={pause.isPending}
      onCheckedChange={(next) => pause.mutate({ id: automation.id, paused: !next })}
      accessibilityLabel={on ? t('automations.detail.pause') : t('automations.detail.resume')}
    />
  );
}
