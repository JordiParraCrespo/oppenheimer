import { Skeleton } from '@oppenheimer/design-system-mobile/skeleton';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { View } from 'react-native';

/** A task row while the board loads: the check, a title and its line, on the row's own frame. */
export function TaskRowSkeleton({ first }: { first: boolean }) {
  return (
    <View
      aria-hidden
      className={cn('flex-row gap-3 px-4 py-3', !first && 'border-t border-border-subtle')}
    >
      <Skeleton className="size-[22px] rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </View>
    </View>
  );
}
