import { useNow } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Clock, Github } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import {
  type AutomationEntity,
  nextRunText,
  pausedReasonText,
  runState,
  triggerListText,
} from '@oppenheimer/frontend-consumer';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { formatAge } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { DetailField } from '../components/detail-field';
import { DetailSection } from '../components/detail-section';
import { RunRow } from '../components/run-row';
import { whereFields } from '../lib/where-fields';
import { AutomationSwitch } from './automation-switch';

const AGE_TICK_MS = 60_000;

/**
 * An automation's page, as the export draws it: Active and when it runs
 * next (or why it is paused), its trigger, its instructions, where it runs
 * and its recent runs, over the room Run now takes at the foot.
 */
export function AutomationDetail({
  automation,
  bottomInset,
}: {
  automation: AutomationEntity;
  bottomInset: number;
}) {
  const { t, i18n } = useTranslation();
  const { data: hosts } = useHosts();
  const now = useNow(AGE_TICK_MS);
  const locale = i18n.resolvedLanguage ?? 'en';
  const host = automation.revision.hostId
    ? (hosts?.find((item) => item.id === automation.revision.hostId)?.name ?? null)
    : null;
  const where = whereFields(automation, host, t);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 16 }}>
      <DetailSection title={null}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="min-w-0 flex-1 gap-0.5">
            <Text variant="body">
              {automation.isPaused
                ? t('automations.status.paused')
                : t('automations.status.active')}
            </Text>
            <Text variant="caption">
              {automation.isPaused
                ? pausedReasonText(automation.pausedReason, t)
                : t('automations.mobile.nextRun', {
                    when: nextRunText(automation, now, locale, t),
                  })}
            </Text>
          </View>
          <AutomationSwitch automation={automation} />
        </View>
      </DetailSection>

      <DetailSection title={t('automations.editor.steps.trigger')}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Icon
            as={automation.primaryTrigger?.source === 'github' ? Github : Clock}
            size={16}
            className="text-foreground"
          />
          <Text variant="body" className="flex-1">
            {triggerListText(automation.triggers, locale, t)}
          </Text>
        </View>
      </DetailSection>

      <DetailSection title={t('automations.mobile.instructions')}>
        <Text variant="body" className="px-4 py-3" selectable>
          {automation.revision.prompt}
        </Text>
      </DetailSection>

      <DetailSection title={t('automations.editor.steps.where')}>
        {where.map((field, index) => (
          <DetailField
            key={field.label}
            label={field.label}
            value={field.value}
            first={index === 0}
          />
        ))}
      </DetailSection>

      <DetailSection title={t('automations.mobile.recentRuns')}>
        {automation.lastRuns.length === 0 ? (
          <Text variant="caption" className="px-4 py-3">
            {t('automations.sidebar.noRuns')}
          </Text>
        ) : (
          automation.lastRuns.map((run, index) => (
            <RunRow
              key={run.id}
              first={index === 0}
              state={t(`automations.runStatus.${run.status}`)}
              tone={runState(run.status)}
              title={run.title}
              age={formatAge(run.createdAt, now, t)}
            />
          ))
        )}
      </DetailSection>
    </ScrollView>
  );
}
