import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Check } from '@oppenheimer/design-system-mobile/icons';
import { View } from 'react-native';

/** The done check a row leads with: a ring, or a filled tick once done. */
export function TaskCheckMark({ done }: { done: boolean }) {
  return done ? (
    <View className="size-[22px] items-center justify-center rounded-full bg-status-active">
      <Icon as={Check} size={14} className="text-white" />
    </View>
  ) : (
    <View className="size-[22px] rounded-full border-2 border-ink-400" />
  );
}
