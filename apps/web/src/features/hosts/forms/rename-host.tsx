import { Button, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type RenameHostDto, renameHostSchema } from '@oppenheimer/shared/schemas/host';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * Rename in place, where the name was: the input, Save and Cancel. Escape
 * cancels, Enter saves. The schema is the API's own (`renameHostSchema`), so
 * a name the route would refuse is refused here first. Spaces become hyphens
 * as you type, as the frame does: a host's name reads as a hostname.
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
  const { register, handleSubmit, formState } = useForm<RenameHostDto>({
    resolver: useZodResolver(renameHostSchema),
    defaultValues: { name: defaultName },
  });
  const field = register('name', {
    setValueAs: (value: string) => value.trim().replace(/\s+/g, '-'),
  });

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={handleSubmit(({ name }) => onSubmit(name))}
      noValidate
    >
      <Input
        {...field}
        size="sm"
        className="w-56 font-mono"
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
