import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import { ErrorBoundary } from '@oppenheimer/frontend-mobile';
import { Stack } from 'expo-router';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, View } from 'react-native';
import { BotTitle } from '../components/bot-title';
import { previewLine } from '../lib/preview-line';
import { BotActions } from '../sections/bot-actions';
import { BotDock } from '../sections/bot-dock';
import { BotTranscript } from '../sections/bot-transcript';

/**
 * One employee's chat, opened from the list: its face and what it does in
 * the navigation bar with its ··· menu, the conversation, and the dock with
 * the card it waits on and the message field.
 */
export function BotScreen({ id }: { id: string }) {
  const { t } = useTranslation();
  const list = useBots({ select: (bots) => bots.find((bot) => bot.id === id) ?? null });
  const [dockHeight, setDockHeight] = useState(0);
  const bot = list.data ?? null;

  if (!bot) {
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
                <EmptyState.Description>{t('bots.mobile.notFound')}</EmptyState.Description>
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
          headerTitle: () => (
            <BotTitle
              name={bot.name}
              initials={bot.initials}
              color={bot.avatarColor}
              line={previewLine(bot.description)}
            />
          ),
          headerRight: () => <BotActions bot={bot} />,
        }}
      />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ErrorBoundary
          fallback={(reset) => (
            <View className="flex-1 items-center justify-center gap-3 px-6">
              <Text variant="body" tone="destructive">
                {t('bots.mobile.chatFailed')}
              </Text>
              <Button variant="outline" onPress={reset}>
                <Text>{t('common.retry')}</Text>
              </Button>
            </View>
          )}
        >
          <Suspense
            fallback={
              <View className="flex-1 items-center justify-center" aria-busy>
                <ActivityIndicator />
              </View>
            }
          >
            <BotTranscript botId={bot.id} bottomInset={dockHeight} />
          </Suspense>
        </ErrorBoundary>
        <BotDock botId={bot.id} botName={bot.name} onHeight={setDockHeight} />
      </KeyboardAvoidingView>
    </>
  );
}
