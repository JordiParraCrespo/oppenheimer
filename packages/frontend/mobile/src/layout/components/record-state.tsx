import { Button } from '@oppenheimer/design-system-mobile/button';
import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

/**
 * What a record's page shows while it has no record to draw: a spinner while
 * the read is under way, the failure with Try again when it failed before
 * any data, and otherwise that the record is gone. One component, so every
 * detail screen keeps its happy path a straight return.
 */
export function RecordState({
  pending,
  failed,
  onRetry,
  notFound,
}: {
  pending: boolean;
  /** The failure in words, when the read failed with nothing to show. */
  failed: string | null;
  onRetry: () => void;
  notFound: string;
}) {
  const { t } = useTranslation();

  if (pending) {
    return (
      <View className="flex-1 items-center justify-center" aria-busy>
        <ActivityIndicator />
      </View>
    );
  }

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text variant="body" tone="destructive">
          {failed}
        </Text>
        <Button variant="outline" onPress={onRetry}>
          <Text>{t('common.retry')}</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center px-6">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Description>{notFound}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </View>
  );
}
