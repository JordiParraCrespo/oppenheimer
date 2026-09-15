import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
  EmptyState,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  SearchInput,
  ToggleGroup,
  ToggleGroupItem,
} from '@oppenheimer/design-system-web';
import { Shield } from '@oppenheimer/design-system-web/icons';
import type { RoleEntity } from '@oppenheimer/frontend';
import { useAuthorizationCatalog, useCreateRole, useUpdateRole } from '@oppenheimer/frontend/react';
import { type RoleEditorDto, roleEditorSchema } from '@oppenheimer/shared/schemas/role';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';
import { PERMISSION_AREAS, type PermissionLevel, permissionLevel } from './permission-areas';

export function RoleEditorDialog({
  role,
  sourceRole,
  onClose,
}: {
  role?: RoleEntity;
  sourceRole?: RoleEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const catalog = useAuthorizationCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
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
  const error = create.error ?? update.error;
  const pending = create.isPending || update.isPending;
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

  const submit = handleSubmit(async (values) => {
    try {
      if (role) {
        await update.mutateAsync({
          id: role.id,
          dto: {
            description: values.description,
            permissions: values.permissions,
          },
        });
      } else {
        await create.mutateAsync({
          name: values.name,
          description: values.description,
          permissions: values.permissions,
        });
      }
      onClose();
    } catch {
      // Mutation errors are rendered in the dialog so the user can retry.
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHero gradient="tealGreen">
          <DialogHeroPlate>
            <Shield />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>
            {t(role ? 'pages.team.roleForm.editTitle' : 'pages.team.roleForm.newTitle')}
          </DialogTitle>
          <DialogDescription>{t('pages.team.roleForm.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-auto flex-col gap-5">
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
                  disabled={pending || Boolean(role)}
                />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="role-description">
                  {t('pages.team.roleForm.details')}
                </FieldLabel>
                <Input
                  {...register('description')}
                  id="role-description"
                  placeholder={t('pages.team.roleForm.detailsPlaceholder')}
                  aria-invalid={Boolean(errors.description)}
                  disabled={pending}
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
                      disabled={pending}
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
                            catalog={catalog.data}
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
            <Button type="button" variant="outline" onClick={onClose}>
              {t('pages.team.common.cancel')}
            </Button>
            <Button type="submit" disabled={pending || catalog.isLoading}>
              {pending
                ? t('pages.team.roleForm.saving')
                : t(role ? 'pages.team.roleForm.save' : 'pages.team.roleForm.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermissionAreaRow({
  area,
  permissions,
  catalog,
  onChange,
}: {
  area: (typeof PERMISSION_AREAS)[number];
  permissions: RoleEditorDto['permissions'];
  catalog: ReturnType<typeof useAuthorizationCatalog>['data'];
  onChange: (permissions: RoleEditorDto['permissions']) => void;
}) {
  const { t } = useTranslation();
  const Icon = area.icon;
  const level = permissionLevel(permissions, area.subjects);
  const grantable = new Set(
    catalog?.grantable.map((rule) => `${rule.subject}:${rule.action}`) ?? [],
  );
  const resources =
    catalog?.groups
      .flatMap((group) => group.resources)
      .filter((resource) => area.subjects.includes(resource.subject)) ?? [];

  function setLevel(next: PermissionLevel) {
    const preserved = permissions.filter(
      (permission) => !area.subjects.includes(permission.subject),
    );
    if (next === 'none') return onChange(preserved);
    const additions = resources.flatMap((resource) =>
      resource.actions
        .filter(
          (action) =>
            grantable.has(`${resource.subject}:${action.name}`) &&
            (next === 'edit' || action.name === 'read'),
        )
        .map((action) => ({ action: action.name, subject: resource.subject })),
    );
    onChange([...preserved, ...additions]);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-3">
      <span className="flex size-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken text-ink-600">
        <Icon className="size-4" />
      </span>
      <span className="min-w-40 flex-1">
        <span className="block font-medium text-ink-900">
          {t(`pages.team.permissionAreas.${area.key}.name`)}
        </span>
        <span className="block text-xs text-ink-400">
          {t(`pages.team.permissionAreas.${area.key}.hint`)}
        </span>
      </span>
      <ToggleGroup
        multiple={false}
        value={[level]}
        onValueChange={(value) => value[0] && setLevel(value[0] as PermissionLevel)}
        variant="outline"
        size="sm"
      >
        {(['none', 'view', 'edit'] as const).map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {t(`pages.team.roleForm.${value}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
