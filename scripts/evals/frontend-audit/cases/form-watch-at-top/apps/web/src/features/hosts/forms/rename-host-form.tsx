import { Button, Field, FieldDescription, FieldGroup, Input } from '@oppenheimer/design-system-web';
import { AuthField, useZodResolver } from '@oppenheimer/frontend-web';
import { type RenameHostDto, renameHostSchema } from '@oppenheimer/shared/schemas/host';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * Rename a host. The suggestions under the field are the names the host
 * reported about itself, so a reader can pick one instead of typing.
 */
export function RenameHostForm({
  current,
  suggestions,
  isPending,
  onSubmit,
}: {
  current: string;
  suggestions: string[];
  isPending: boolean;
  onSubmit: (values: RenameHostDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RenameHostDto>({
    resolver: useZodResolver(renameHostSchema),
    defaultValues: { name: current },
  });
  const name = watch('name');

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <AuthField label={t('common.edit')} htmlFor="name" error={errors.name}>
          <Input
            {...register('name')}
            id="name"
            aria-invalid={Boolean(errors.name)}
            disabled={isPending}
          />
        </AuthField>
        <Field>
          <FieldDescription>{name.length}/64</FieldDescription>
        </Field>
        <div className="flex flex-wrap gap-1">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setValue('name', suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        <Button type="submit" disabled={isPending || name === current}>
          {t('common.save')}
        </Button>
      </FieldGroup>
    </form>
  );
}
