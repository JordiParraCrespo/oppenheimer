import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BrandGlyph } from '../../theme';

/** Mark plus wordmark, as it sits in the top-left of every auth screen. */
export function BrandLogo({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation();

  return (
    <View className={cn('flex-row items-center gap-2.5', className)}>
      <BrandGlyph />
      <Text className="text-lg font-medium text-ink-900">{label ?? t('common.appName')}</Text>
    </View>
  );
}
