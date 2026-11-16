import { useNow } from '@oppenheimer/design-system-mobile';
import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Zap } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useAutomations } from '@oppenheimer/frontend-consumer/react';
import { triggerListText } from '@oppenheimer/frontend-core';
import { formatAge, ListGroup } from '@oppenheimer/frontend-mobile';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { AutomationRow } from '../components/automation-row';
import { AutomationRowSkeleton } from '../components/automation-row-skeleton';
import { runTone } from '../lib/automation-words';
import { AutomationSwitch } from './automation-switch';

const AGE_TICK_MS = 60_000;

/**
 * Your automations as the export lists them, on one card: each with its
 * trigger, how its last run went, and the switch that pauses it. A row
 * opens the automation. The list polls while a run is live, and the
 * workspace's feed moves it when a run starts or ends elsewhere.
 */
export function AutomationsList() {
  const { t, i18n } = useTranslation();
  const automations = useAutomations();
  const now = useNow(AGE_TICK_MS);
  const locale = i18n.resolvedLanguage ?? 'en';

  if (automations.isPending) {
    return (
      <View aria-busy>
        <ListGroup title={null} count={null}>
          {[0, 1, 2].map((index) => (
            <AutomationRowSkeleton key={index} first={index === 0} />
          ))}
        </ListGroup>
      </View>
    );
  }

  if (automations.isError && !automations.data) {
    return (
      <View className="items-start gap-3 px-5 pt-6">
        <Text variant="body" tone="destructive">
          {t('automations.sidebar.loadFailed')}
        </Text>
        <Button variant="outline" onPress={() => automations.refetch()}>
          <Text>{t('common.retry')}</Text>
        </Button>
      </View>
    );
  }

  const rows = automations.data ?? [];
  if (rows.length === 0) {
    return (
      <View className="px-4 pt-10">
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Icon as={Zap} size={24} />
            </EmptyState.Media>
            <EmptyState.Description>{t('automations.mobile.empty')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </View>
    );
  }

  const status = (automation: AutomationEntity) => {
    if (automation.isPaused) return t('automations.status.paused');
    const last = automation.lastRuns[0];
    if (!last) return t('automations.sidebar.noRuns');
    return `${t(`automations.runStatus.${last.status}`)} · ${formatAge(last.createdAt, now, t)}`;
  };

  return (
    <View className="pb-6">
      <ListGroup title={null} count={null}>
        {rows.map((automation, index) => (
          <Link key={automation.id} href={`/automations/${automation.id}`} asChild>
            <Pressable accessibilityRole="button" className="active:bg-surface-hover">
              <AutomationRow
                first={index === 0}
                name={automation.name}
                github={automation.primaryTrigger?.source === 'github'}
                trigger={triggerListText(automation.triggers, locale, t)}
                status={status(automation)}
                tone={
                  automation.isPaused
                    ? 'paused'
                    : runTone(automation.lastRuns[0]?.status ?? 'completed')
                }
                paused={automation.isPaused}
                trailing={<AutomationSwitch automation={automation} />}
              />
            </Pressable>
          </Link>
        ))}
      </ListGroup>
    </View>
  );
}
