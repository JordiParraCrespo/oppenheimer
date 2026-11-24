import { Button } from '@oppenheimer/design-system-mobile/button';
import { Text } from '@oppenheimer/design-system-mobile/text';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export function ScreenErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <Text className="text-center text-xl font-semibold text-foreground">{t('common.error')}</Text>
      <Button onPress={onReset} className="mt-3">
        <Text>{t('auth.session.retry')}</Text>
      </Button>
    </View>
  );
}

/** Outside providers — no hooks from them. */
export function AppErrorFallback() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-8">
      <Text className="text-center text-xl font-semibold text-foreground">
        {i18next.t('common.error')}
      </Text>
    </View>
  );
}
