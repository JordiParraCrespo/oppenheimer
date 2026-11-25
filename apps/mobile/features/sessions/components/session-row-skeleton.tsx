import { Skeleton } from '@oppenheimer/design-system-mobile/skeleton';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { View } from 'react-native';

/** A session row while the list loads: the disc, a name and its line, on the row's own frame. */
export function SessionRowSkeleton({ first }: { first: boolean }) {
  return (
    <View
      aria-hidden
      className={cn('min-h-16 flex-row gap-3 px-4 py-3', !first && 'border-t border-border-subtle')}
    >
      <Skeleton className="size-8 rounded-full" />
      <View className="flex-1 gap-2 pt-0.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </View>
      <Skeleton className="h-3 w-6" />
    </View>
  );
}
