import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { Plus } from '@oppenheimer/design-system-mobile/icons';
import { cn } from '@oppenheimer/design-system-mobile/utils';
import {
  type BoardFilter,
  filingOf,
  type MilestoneEntity,
  type ProjectEntity,
} from '@oppenheimer/frontend-consumer';
import { useCreateTask } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TextInput, View } from 'react-native';

/**
 * Add task at the foot of Not started, the console's column composer: a title,
 * and Return adds it, filed where the board is looking (the project picked,
 * else Unassigned). The field clears for the next one; a refusal gives the
 * title back and says so.
 */
export function AddTask({
  filter,
  milestones,
  projects,
  first,
}: {
  filter: BoardFilter;
  milestones: readonly MilestoneEntity[];
  projects: readonly ProjectEntity[];
  first: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const create = useCreateTask();

  const add = () => {
    const text = title.trim();
    if (!text) return;
    const unassigned = projects.find((project) => project.isUnassigned)?.id;
    const { projectId, milestoneId } = filingOf(filter, milestones, unassigned);
    setTitle('');
    create.mutate(
      { title: text, status: 'todo', projectId, milestoneId },
      {
        onError: () => {
          setTitle((typed) => (typed.trim() ? typed : text));
          Alert.alert(t('tasks.board.addFailed'));
        },
      },
    );
  };

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 px-4 py-2',
        !first && 'border-t border-border-subtle',
      )}
    >
      <Icon as={Plus} size={18} className="text-muted-foreground" />
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        placeholder={t('tasks.board.addTask')}
        accessibilityLabel={t('tasks.board.addTask')}
        returnKeyType="done"
        submitBehavior="submit"
        className="h-9 flex-1 text-[15px] text-foreground placeholder:text-ink-400"
      />
    </View>
  );
}
