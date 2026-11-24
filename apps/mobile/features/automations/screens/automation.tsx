import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { useAutomations } from '@oppenheimer/frontend-consumer/react';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { AutomationActions } from '../sections/automation-actions';
import { AutomationDetail } from '../sections/automation-detail';
import { RunNow } from '../sections/run-now';

/**
 * One automation, opened from the list: its name in the navigation bar with
 * its ··· menu, its page, and Run now at the foot. It is read off the list
 * the tab holds, which polls while a run is live. A delete from its ···
 * holds the automation as it was confirmed, so the list's refetch without it
 * does not flash "not found" while the page goes back.
 */
export function AutomationScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const list = useAutomations({ select: (rows) => rows.find((row) => row.id === id) ?? null });
  const [footHeight, setFootHeight] = useState(0);
  const [leaving, setLeaving] = useState<AutomationEntity | null>(null);
  const automation = list.data ?? leaving;

  if (!automation) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        {list.isPending ? (
          <View className="flex-1 items-center justify-center" aria-busy>
            <ActivityIndicator />
          </View>
        ) : list.isError ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Text variant="body" tone="destructive">
              {t('automations.detail.loadFailed')}
            </Text>
            <Button variant="outline" onPress={() => list.refetch()}>
              <Text>{t('common.retry')}</Text>
            </Button>
          </View>
        ) : (
          <View className="flex-1 justify-center px-6">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Description>{t('automations.detail.notFound')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </View>
        )}
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: automation.name,
          headerRight: () => (
            <AutomationActions
              automation={automation}
              onDeleting={(deleting) => setLeaving(deleting ? automation : null)}
            />
          ),
        }}
      />
      <View className="flex-1">
        <AutomationDetail automation={automation} bottomInset={footHeight} />
        <RunNow automationId={automation.id} onHeight={setFootHeight} />
      </View>
    </>
  );
}
