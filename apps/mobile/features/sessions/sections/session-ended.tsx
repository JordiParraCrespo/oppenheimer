import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Text } from '@oppenheimer/design-system-mobile/text';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useRestartSession, useRetrySession } from '@oppenheimer/frontend-consumer/react';
import { openBrowserAsync } from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

/**
 * A session there is no terminal to attach to, and what can be done about
 * it: one still starting waits, a failed start is tried again, a stopped one
 * is restarted (the console's Restart), a cloud run opens where it runs, and
 * a deleted one only says so.
 */
export function SessionEnded({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const restart = useRestartSession();
  const retry = useRetrySession();

  if (session.isProvisioning) {
    return (
      <View className="flex-1 items-center justify-center gap-3" aria-busy>
        <ActivityIndicator />
        <Text variant="caption">{t('sessions.mobile.starting')}</Text>
      </View>
    );
  }

  const body = (() => {
    if (session.isCloud) {
      return {
        line: t('sessions.mobile.cloud', { place: session.runsOn }),
        action: session.cloudUrl
          ? {
              label: t('sessions.mobile.openCloud'),
              pending: false,
              run: () => void openBrowserAsync(session.cloudUrl ?? ''),
            }
          : null,
        failed: null,
      };
    }
    if (session.lifecycle === 'failed') {
      return {
        line: t('sessions.mobile.failed'),
        action: {
          label: retry.isPending
            ? t('sessions.provisioning.retrying')
            : t('sessions.provisioning.retry'),
          pending: retry.isPending,
          run: () => retry.mutate(session.id),
        },
        failed: retry.isError ? t('sessions.provisioning.retryFailed') : null,
      };
    }
    if (session.isResolved) {
      return {
        line: session.isFolder ? t('sessions.closed.deletedFolder') : t('sessions.closed.deleted'),
        action: null,
        failed: null,
      };
    }
    return {
      line: t('sessions.shared.stopped.title'),
      action: {
        label: restart.isPending ? t('sessions.closed.restarting') : t('sessions.closed.restart'),
        pending: restart.isPending,
        run: () => restart.mutate(session.id),
      },
      failed: restart.isError ? t('sessions.closed.restartFailed') : null,
    };
  })();

  return (
    <View className="flex-1 justify-center gap-4 px-6">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Description>{body.line}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
      {body.action ? (
        <Button onPress={body.action.run} disabled={body.action.pending}>
          <Text>{body.action.label}</Text>
        </Button>
      ) : null}
      {body.failed ? (
        <Text variant="caption" tone="destructive" className="text-center">
          {body.failed}
        </Text>
      ) : null}
    </View>
  );
}
