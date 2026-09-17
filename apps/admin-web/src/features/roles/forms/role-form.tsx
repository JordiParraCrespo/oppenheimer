import {
  Alert,
  AlertDescription,
  Button,
  DialogBody,
  DialogFooter,
  EmptyState,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  SearchInput,
} from '@oppenheimer/design-system-web';
import type { AuthorizationCatalog, RoleEntity } from '@oppenheimer/frontend-admin';
import { useErrorMessage, useZodResolver } from '@oppenheimer/frontend-web';
import { type RoleEditorDto, roleEditorSchema } from '@oppenheimer/shared/schemas/role';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PermissionAreaRow } from '@/features/roles/components/permission-area-row';
import { PERMISSION_AREAS } from '@/features/roles/lib/permission-areas';

export function RoleForm({
  role,
  sourceRole,
  catalog,
  catalogLoading,
  isPending,
  error,
  onSubmit,
  onCancel,
}: {
  /** The role being edited; absent when creating. */
  role?: RoleEntity;
  /** The role a new one is copied from. */
  sourceRole?: RoleEntity;
  catalog: AuthorizationCatalog | undefined;
  catalogLoading: boolean;
  isPending: boolean;
  error: Error | null;
  onSubmit: (values: RoleEditorDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [permissionSearch, setPermissionSearch] = useState('');
  const template = sourceRole ?? role;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RoleEditorDto>({
    resolver: useZodResolver(roleEditorSchema),
    defaultValues: {
      name: role?.name ?? (sourceRole ? `${sourceRole.name} copy` : ''),
      description: template?.description ?? '',
      permissions: template?.permissions ?? [],
    },
  });
  const normalizedPermissionSearch = permissionSearch.trim().toLocaleLowerCase();
  const visiblePermissionAreas = PERMISSION_AREAS.filter((area) =>
    [
      t(`pages.team.permissionAreas.${area.key}.name`),
      t(`pages.team.permissionAreas.${area.key}.hint`),
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedPermissionSearch),
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex min-h-0 flex-auto flex-col gap-5"
    >
      <DialogBody>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {resolveError(error, t('pages.team.common.error')).message}
              </AlertDescription>
            </Alert>
          )}
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="role-name">{t('pages.team.roleForm.name')}</FieldLabel>
            <Input
              {...register('name')}
              id="role-name"
              placeholder={t('pages.team.roleForm.namePlaceholder')}
              aria-invalid={Boolean(errors.name)}
              disabled={isPending || Boolean(role)}
            />
            <FieldError errors={[errors.name]} />
          </Field>
          <Field data-invalid={Boolean(errors.description)}>
            <FieldLabel htmlFor="role-description">{t('pages.team.roleForm.details')}</FieldLabel>
            <Input
              {...register('description')}
              id="role-description"
              placeholder={t('pages.team.roleForm.detailsPlaceholder')}
              aria-invalid={Boolean(errors.description)}
              disabled={isPending}
            />
            <FieldError errors={[errors.description]} />
          </Field>
          <Controller
            control={control}
            name="permissions"
            render={({ field }) => (
              <Field>
                <FieldLabel>{t('pages.team.roleForm.permissions')}</FieldLabel>
                <SearchInput
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder={t('pages.team.roleForm.searchPermissions')}
                  aria-label={t('pages.team.roleForm.searchPermissions')}
                  hint={null}
                  containerClassName="w-full"
                  disabled={isPending}
                />
                {visiblePermissionAreas.length > 0 ? (
                  // No scroll cap of its own: the dialog body already
                  // scrolls, and a list that scrolled inside it gave the
                  // card two scrollbars and a wheel that stopped at the
                  // list's edge.
                  <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle">
                    {visiblePermissionAreas.map((area) => (
                      <PermissionAreaRow
                        key={area.key}
                        area={area}
                        permissions={field.value}
                        catalog={catalog}
                        onChange={field.onChange}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState className="border border-border-subtle py-6">
                    <EmptyState.Header>
                      <EmptyState.Title>
                        {t('pages.team.roleForm.noPermissionResults')}
                      </EmptyState.Title>
                    </EmptyState.Header>
                  </EmptyState>
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </DialogBody>
      <DialogFooter className="border-t border-border-subtle pt-5">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('pages.team.common.cancel')}
        </Button>
        <Button type="submit" disabled={isPending || catalogLoading}>
          {isPending
            ? t('pages.team.roleForm.saving')
            : t(role ? 'pages.team.roleForm.save' : 'pages.team.roleForm.create')}
        </Button>
      </DialogFooter>
    </form>
  );
}
