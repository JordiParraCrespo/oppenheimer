import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  DialogFooter,
  FieldGroup,
} from '@oppenheimer/design-system-web';
import type { RoleEntity } from '@oppenheimer/frontend-admin';
import { useErrorMessage, useZodResolver } from '@oppenheimer/frontend-web';
import {
  type AdminAssignRolesDto,
  adminAssignRolesSchema,
} from '@oppenheimer/shared/schemas/admin';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

export function AssignRolesForm({
  roles,
  assignedRoles,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  roles: RoleEntity[];
  assignedRoles: RoleEntity[];
  isPending: boolean;
  error: Error | null;
  onSubmit: (values: AdminAssignRolesDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { control, handleSubmit } = useForm<AdminAssignRolesDto>({
    resolver: useZodResolver(adminAssignRolesSchema),
    defaultValues: { roleIds: assignedRoles.map((role) => role.id) },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{resolveError(error, t('common.error')).message}</AlertDescription>
          </Alert>
        )}
        <Controller
          control={control}
          name="roleIds"
          render={({ field }) => (
            <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle">
              {roles.map((role) => {
                const checked = field.value.includes(role.id);
                return (
                  <label
                    key={role.id}
                    htmlFor={`user-role-${role.id}`}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3"
                  >
                    <Checkbox
                      id={`user-role-${role.id}`}
                      checked={checked}
                      onCheckedChange={(next) =>
                        field.onChange(
                          next
                            ? [...field.value, role.id]
                            : field.value.filter((id) => id !== role.id),
                        )
                      }
                      disabled={isPending}
                    />
                    <span>
                      <span className="block font-medium text-ink-900">{role.name}</span>
                      <span className="block text-sm text-ink-500">
                        {role.description || t('control.users.roles.noDescription')}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  );
}
