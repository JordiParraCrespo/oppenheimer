import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import type { BotRoutineEntity } from '@oppenheimer/frontend-consumer';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  BOT_ROUTINE_NAME_MAX,
  BOT_ROUTINE_PROMPT_MAX,
  type BotRoutineTaskDto,
  botRoutineTaskSchema,
} from '@oppenheimer/shared/schemas/bot';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * A routine's two typed fields: its name and the prompt the bot runs every
 * time. When it runs is not here; the dialog says where that changes.
 */
export function BotRoutineForm({
  routine,
  isPending,
  onSubmit,
  onCancel,
}: {
  routine: BotRoutineEntity;
  isPending: boolean;
  onSubmit: (values: BotRoutineTaskDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState } = useForm<BotRoutineTaskDto>({
    resolver: useZodResolver(botRoutineTaskSchema),
    defaultValues: { name: routine.name, prompt: routine.prompt },
  });
  const { errors } = formState;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor="routine-name">{t('bots.settings.routines.dialog.name')}</FieldLabel>
        <Input
          {...register('name')}
          id="routine-name"
          maxLength={BOT_ROUTINE_NAME_MAX}
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          disabled={isPending}
        />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={Boolean(errors.prompt)}>
        <FieldLabel htmlFor="routine-prompt">
          {t('bots.settings.routines.dialog.prompt')}
        </FieldLabel>
        <Textarea
          {...register('prompt')}
          id="routine-prompt"
          rows={10}
          maxLength={BOT_ROUTINE_PROMPT_MAX}
          aria-invalid={Boolean(errors.prompt)}
          disabled={isPending}
        />
        <FieldDescription>{t('bots.settings.routines.dialog.promptHint')}</FieldDescription>
        <FieldError errors={[errors.prompt]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          pending={isPending}
          pendingLabel={t('bots.settings.routines.dialog.saving')}
        >
          {t('bots.settings.routines.dialog.save')}
        </Button>
      </div>
    </form>
  );
}
