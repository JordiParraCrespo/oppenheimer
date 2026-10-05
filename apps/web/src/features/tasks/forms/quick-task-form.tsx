import { Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type QuickTaskDto, quickTaskSchema } from '@oppenheimer/shared/schemas/task';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * A column's inline composer: a title, Enter adds and stays open for the next,
 * Escape (or leaving it empty) closes it. `hint` says where the task will be
 * filed when the board is filtered.
 */
export function QuickTaskForm({
  hint,
  onSubmit,
  onClose,
}: {
  hint: string | null;
  onSubmit: (title: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, getValues } = useForm<QuickTaskDto>({
    resolver: useZodResolver(quickTaskSchema),
    defaultValues: { title: '' },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-1 rounded-md border border-border bg-card p-2.5"
      onSubmit={handleSubmit(({ title }) => {
        onSubmit(title);
        reset({ title: '' });
      })}
    >
      <Input
        {...register('title', {
          onBlur: () => {
            if (!getValues('title').trim()) onClose();
          },
        })}
        size="sm"
        className="h-auto border-0 bg-transparent px-0 hover:border-0 has-focus-visible:ring-0"
        autoFocus
        placeholder={t('tasks.board.quickPlaceholder')}
        aria-label={t('tasks.board.quickPlaceholder')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      />
      {hint ? <span className="text-xs text-fg-subtle">{hint}</span> : null}
    </form>
  );
}
