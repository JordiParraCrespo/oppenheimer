import { useNow } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Clock, Github } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { type AutomationEntity, triggerListText } from '@oppenheimer/frontend-consumer';
import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { formatAge } from '@oppenheimer/frontend-mobile';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { DetailField } from '../components/detail-field';
import { DetailSection } from '../components/detail-section';
import { RunRow } from '../components/run-row';
import { agentWords, nextRunWords, pausedReasonKey, runTone } from '../lib/automation-words';
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
  const next = nextRunWords(automation, now, locale);
  const nextText =
    'text' in next ? next.text : t(next.key, 'time' in next ? { time: next.time } : {});
  const { revision } = automation;
  const host = revision.hostId ? hosts?.find((item) => item.id === revision.hostId)?.name : null;
  const where = [
    revision.repositories.length > 0
      ? {
          label: t('automations.editor.repositories'),
          value: revision.repositories
            .map((repository) => repository.fullName.split('/').pop())
            .join(', '),
        }
      : null,
    host ? { label: t('automations.editor.host'), value: host } : null,
    {
      label: t('automations.editor.agent'),
      value: agentWords(automation, t('automations.editor.placeClaudeCloud')),
    },
  ].filter((field): field is { label: string; value: string } => field !== null);

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
                ? t(pausedReasonKey(automation.pausedReason))
                : t('automations.mobile.nextRun', { when: nextText })}
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
          {revision.prompt}
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
              tone={runTone(run.status)}
              title={run.title}
              age={formatAge(run.createdAt, now, t)}
            />
          ))
        )}
      </DetailSection>
    </ScrollView>
  );
}
