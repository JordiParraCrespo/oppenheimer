import { Skeleton } from '@oppenheimer/design-system-mobile/skeleton';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import { View } from 'react-native';

/** An automation row while the list loads: the glyph, three lines and the switch, on the row's own frame. */
export function AutomationRowSkeleton({ first }: { first: boolean }) {
  return (
    <View
      aria-hidden
      className={cn(
        'min-h-16 flex-row items-center gap-3 px-4 py-3',
        !first && 'border-t border-border-subtle',
      )}
    >
      <Skeleton className="size-8 rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-3 w-32" />
      </View>
      <Skeleton className="h-7 w-12 rounded-full" />
    </View>
  );
}
