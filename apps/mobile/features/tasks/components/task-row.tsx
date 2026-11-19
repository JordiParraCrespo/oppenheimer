import { Text } from '@oppenheimer/design-system-mobile/text';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import type { TaskDueTone } from '@oppenheimer/frontend-consumer';
import type { ReactNode } from 'react';
import { View } from 'react-native';

const DUE: Record<TaskDueTone, string> = {
  overdue: 'text-destructive',
  soon: 'text-foreground',
  default: '',
};

/**
 * One task, as the console's card draws it: the done check (`check`), the
 * title (struck through once done), where it is filed, its due date, and the
 * session line under it (`session`).
 */
export function TaskRow({
  title,
  done,
  filed,
  due,
  check,
  session,
  first,
}: {
  title: string;
  done: boolean;
  filed: string | null;
  due: { text: string; tone: TaskDueTone } | null;
  check: ReactNode;
  session: ReactNode;
  first: boolean;
}) {
  return (
    <View className={cn('flex-row gap-3 px-4 py-3', !first && 'border-t border-border-subtle')}>
      {check}
      <View className="min-w-0 flex-1 gap-1">
        <Text
          variant="body"
          className={cn(done && 'text-muted-foreground line-through')}
          numberOfLines={2}
        >
          {title}
        </Text>
        {filed || due ? (
          <View className="flex-row items-center gap-2">
            {filed ? (
              <Text variant="caption" className="flex-shrink" numberOfLines={1}>
                {filed}
              </Text>
            ) : null}
            {due ? (
              <Text variant="caption" className={DUE[due.tone]}>
                {due.text}
              </Text>
            ) : null}
          </View>
        ) : null}
        {session}
      </View>
    </View>
  );
}
