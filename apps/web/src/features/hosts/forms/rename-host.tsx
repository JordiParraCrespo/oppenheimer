import { Button, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type RenameHostDto, renameHostSchema } from '@oppenheimer/shared/schemas/host';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * Rename in place, where the name was, as the frame draws it: a small mono
 * input, Save and Cancel. Enter saves, Escape cancels. Spaces become hyphens
 * as you type, and saving an empty name keeps the old one. The schema is the
 * API's own (`renameHostSchema`), so a name the route would refuse is refused
 * here first.
 */
export function RenameHostForm({
  defaultName,
  pending,
  onSubmit,
  onCancel,
}: {
  defaultName: string;
  pending: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, getValues, formState } = useForm<RenameHostDto>({
    resolver: useZodResolver(renameHostSchema),
    defaultValues: { name: defaultName },
  });
  const field = register('name', { setValueAs: (value: string) => value.trim() });

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        if (getValues('name').trim() === '') {
          event.preventDefault();
          onCancel();
          return;
        }
        void handleSubmit(({ name }) => onSubmit(name))(event);
      }}
      noValidate
    >
      <Input
        {...field}
        onChange={(event) => {
          event.target.value = event.target.value.replace(/\s+/g, '-');
          void field.onChange(event);
        }}
        size="sm"
        className="w-55 font-mono text-[13px]"
        aria-label={t('hosts.settings.renameLabel')}
        aria-invalid={Boolean(formState.errors.name)}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {t('hosts.settings.save')}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        {t('hosts.settings.cancel')}
      </Button>
    </form>
  );
}
