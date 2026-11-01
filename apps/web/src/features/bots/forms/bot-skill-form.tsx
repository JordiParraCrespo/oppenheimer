import {
  Button,
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  BOT_SKILL_BODY_MAX,
  BOT_SKILL_DESCRIPTION_MAX,
  BOT_SKILL_NAME_MAX,
  type BotSkillDto,
  botSkillNameDraft,
  botSkillSchema,
} from '@oppenheimer/shared/schemas/bot-skill';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SkillCommandHint } from '@/features/bots/components/skill-command-hint';

/**
 * A skill: its name (the command, typed into shape as it is written), what it
 * does, its instructions in mono, and who may run it. Both boxes start ticked;
 * the schema refuses neither.
 */
export function BotSkillForm({
  skill,
  isPending,
  onSubmit,
  onCancel,
}: {
  skill: BotSkillEntity | null;
  isPending: boolean;
  onSubmit: (values: BotSkillDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, formState } = useForm<BotSkillDto>({
    resolver: useZodResolver(botSkillSchema),
    defaultValues: {
      name: skill?.name ?? '',
      description: skill?.description ?? '',
      body: skill?.body ?? '',
      userInvocable: skill?.userInvocable ?? true,
      modelInvocable: skill?.modelInvocable ?? true,
    },
  });
  const { errors } = formState;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor="skill-name">{t('bots.settings.skills.dialog.name')}</FieldLabel>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <Input
              id="skill-name"
              mono
              value={field.value}
              onChange={(event) => field.onChange(botSkillNameDraft(event.target.value))}
              onBlur={field.onBlur}
              ref={field.ref}
              maxLength={BOT_SKILL_NAME_MAX}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errors.name)}
              disabled={isPending}
            />
          )}
        />
        <SkillCommandHint control={control} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={Boolean(errors.description)}>
        <FieldLabel htmlFor="skill-description">
          {t('bots.settings.skills.dialog.summary')}
        </FieldLabel>
        <Input
          {...register('description')}
          id="skill-description"
          maxLength={BOT_SKILL_DESCRIPTION_MAX}
          placeholder={t('bots.settings.skills.dialog.summaryPlaceholder')}
          aria-invalid={Boolean(errors.description)}
          disabled={isPending}
        />
        <FieldDescription>{t('bots.settings.skills.dialog.summaryHint')}</FieldDescription>
        <FieldError errors={[errors.description]} />
      </Field>
      <Field data-invalid={Boolean(errors.body)}>
        <FieldLabel htmlFor="skill-body">{t('bots.settings.skills.dialog.body')}</FieldLabel>
        <Textarea
          {...register('body')}
          id="skill-body"
          variant="code"
          rows={8}
          maxLength={BOT_SKILL_BODY_MAX}
          spellCheck={false}
          placeholder={t('bots.settings.skills.dialog.bodyPlaceholder')}
          aria-invalid={Boolean(errors.body)}
          disabled={isPending}
        />
        <FieldError errors={[errors.body]} />
      </Field>
      <div className="flex flex-col gap-2.5">
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control. */}
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={control}
            name="userInvocable"
            render={({ field }) => (
              <Checkbox
                checked={field.value ?? true}
                onCheckedChange={(checked) => field.onChange(checked)}
                disabled={isPending}
              />
            )}
          />
          {t('bots.settings.skills.dialog.userInvocable')}
        </label>
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control. */}
        <label className="flex items-center gap-2 text-sm">
          <Controller
            control={control}
            name="modelInvocable"
            render={({ field }) => (
              <Checkbox
                checked={field.value ?? true}
                onCheckedChange={(checked) => field.onChange(checked)}
                disabled={isPending}
              />
            )}
          />
          {t('bots.settings.skills.dialog.modelInvocable')}
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          pending={isPending}
          pendingLabel={t('bots.settings.skills.dialog.saving')}
        >
          {t('bots.settings.skills.dialog.save')}
        </Button>
      </div>
    </form>
  );
}
