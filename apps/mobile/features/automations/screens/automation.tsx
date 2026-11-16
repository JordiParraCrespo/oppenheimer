import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
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
 * the tab holds, which polls while a run is live.
 */
export function AutomationScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const list = useAutomations({ select: (rows) => rows.find((row) => row.id === id) ?? null });
  const [footHeight, setFootHeight] = useState(0);
  const automation = list.data ?? null;

  if (!automation) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        {list.isPending ? (
          <View className="flex-1 items-center justify-center" aria-busy>
            <ActivityIndicator />
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
          headerRight: () => <AutomationActions automation={automation} />,
        }}
      />
      <View className="flex-1">
        <AutomationDetail automation={automation} bottomInset={footHeight} />
        <RunNow automationId={automation.id} onHeight={setFootHeight} />
      </View>
    </>
  );
}
