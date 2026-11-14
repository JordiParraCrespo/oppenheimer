import { EmptyState } from '@oppenheimer/design-system-mobile/empty-state';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import type { LucideIcon } from '@oppenheimer/design-system-mobile/icons';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

/** A section the app has a place for but does not draw yet. */
export function TabPlaceholder({ icon, description }: { icon: LucideIcon; description: string }) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 justify-center px-4 pt-12">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Icon as={icon} size={24} />
          </EmptyState.Media>
          <EmptyState.Title>{t('common.comingToMobile.title')}</EmptyState.Title>
          <EmptyState.Description>{description}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </View>
  );
}
