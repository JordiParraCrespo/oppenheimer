import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { cloudProviderLabel, sessionAgentLabel } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessions } from '@oppenheimer/frontend-consumer/react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { SessionTitle } from '../components/session-title';
import { dotOf, leadKeyOf, needsInput } from '../lib/session-filters';
import { SessionActions } from '../sections/session-actions';
import { SessionEnded } from '../sections/session-ended';
import { SessionPane } from '../sections/session-pane';

/**
 * One session, opened from the list: its name and state in the navigation
 * bar with its ··· menu, then its terminal and chat while it is live, or
 * what can be done about it while it is not. The row is read off the list
 * the tab already holds, which the workspace's feed keeps current.
 */
export function SessionScreen({ id, webUrl }: { id: string; webUrl: string }) {
  const { t } = useTranslation();
  const list = useSessions({ select: (rows) => rows.find((row) => row.id === id) ?? null });
  const { data: hosts } = useHosts();
  const session = list.data ?? null;

  if (!session) {
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
              {t('sessions.mobile.loadFailed')}
            </Text>
            <Button variant="outline" onPress={() => list.refetch()}>
              <Text>{t('common.retry')}</Text>
            </Button>
          </View>
        ) : (
          <View className="flex-1 justify-center px-6">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Description>{t('sessions.mobile.notFound')}</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </View>
        )}
      </>
    );
  }

  const place = session.cloud
    ? cloudProviderLabel(session.cloud.provider)
    : (hosts?.find((host) => host.id === session.hostId)?.name ?? '');
  const line = [
    needsInput(session) ? t('sessions.session.state.waiting-on-you') : t(leadKeyOf(session)),
    sessionAgentLabel(session.agent),
    place,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SessionTitle name={session.name} dot={dotOf(session)} line={line} />,
          headerRight: () => <SessionActions session={session} webUrl={webUrl} />,
        }}
      />
      {session.isLive && !session.isCloud ? (
        <SessionPane key={session.id} session={session} />
      ) : (
        <SessionEnded session={session} />
      )}
    </>
  );
}
