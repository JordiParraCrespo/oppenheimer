import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogTitle,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import { KeyRound, Shield, UserPlus } from '@oppenheimer/design-system-web/icons';
import type { AdminUserEntity, RoleEntity } from '@oppenheimer/frontend';
import {
  useAssignAdminUserRoles,
  useCreateAdminUser,
  useSetAdminUserPassword,
} from '@oppenheimer/frontend/react';
import {
  type AdminAssignRolesDto,
  type AdminCreateUserDto,
  adminAssignRolesSchema,
  adminCreateUserSchema,
  type SetUserPasswordDto,
  setUserPasswordSchema,
} from '@oppenheimer/shared/schemas/admin';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

export function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const create = useCreateAdminUser();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminCreateUserDto>({
    resolver: useZodResolver(adminCreateUserSchema),
    defaultValues: { email: '', name: '', password: '', role: 'user' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({ ...values, password: values.password || undefined, role: 'user' });
      onClose();
    } catch {
      // The request error stays visible in the dialog.
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="tealGreen">
          <DialogHeroPlate>
            <UserPlus />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('control.users.create.title')}</DialogTitle>
          <DialogDescription>{t('control.users.create.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {create.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(create.error, t('common.error')).message}
                </AlertDescription>
              </Alert>
            )}
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="admin-user-name">{t('control.users.columns.name')}</FieldLabel>
              <Input id="admin-user-name" {...register('name')} disabled={create.isPending} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="admin-user-email">{t('control.users.columns.email')}</FieldLabel>
              <Input
                id="admin-user-email"
                type="email"
                {...register('email')}
                disabled={create.isPending}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="admin-user-password">
                {t('control.users.create.password')}
              </FieldLabel>
              <Input
                id="admin-user-password"
                type="password"
                {...register('password')}
                disabled={create.isPending}
              />
              <FieldError errors={[errors.password]} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {t('control.users.create.submit')}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignRolesDialog({
  user,
  roles,
  assignedRoles,
  onClose,
}: {
  user: AdminUserEntity;
  roles: RoleEntity[];
  assignedRoles: RoleEntity[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const assign = useAssignAdminUserRoles();
  const { control, handleSubmit } = useForm<AdminAssignRolesDto>({
    resolver: useZodResolver(adminAssignRolesSchema),
    defaultValues: { roleIds: assignedRoles.map((role) => role.id) },
  });
  const submit = handleSubmit(async ({ roleIds }) => {
    try {
      await assign.mutateAsync({ userId: user.id, roleIds });
      onClose();
    } catch {
      // The request error stays visible in the dialog.
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="tealGreen">
          <DialogHeroPlate>
            <Shield />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('control.users.roles.title')}</DialogTitle>
          <DialogDescription>
            {t('control.users.roles.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {assign.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(assign.error, t('common.error')).message}
                </AlertDescription>
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
                          disabled={assign.isPending}
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
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={assign.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SetPasswordDialog({
  user,
  onClose,
}: {
  user: AdminUserEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const setPassword = useSetAdminUserPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetUserPasswordDto>({
    resolver: useZodResolver(setUserPasswordSchema),
    defaultValues: { newPassword: '' },
  });
  const submit = handleSubmit(async ({ newPassword }) => {
    try {
      await setPassword.mutateAsync({ id: user.id, newPassword });
      onClose();
    } catch {
      // The request error stays visible in the dialog.
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHero gradient="pinkCoral">
          <DialogHeroPlate>
            <KeyRound />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('control.users.password.title')}</DialogTitle>
          <DialogDescription>
            {t('control.users.password.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            {setPassword.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {resolveError(setPassword.error, t('common.error')).message}
                </AlertDescription>
              </Alert>
            )}
            <Field data-invalid={Boolean(errors.newPassword)}>
              <FieldLabel htmlFor="new-user-password">
                {t('control.users.password.label')}
              </FieldLabel>
              <Input
                id="new-user-password"
                type="password"
                {...register('newPassword')}
                disabled={setPassword.isPending}
              />
              <FieldError errors={[errors.newPassword]} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={setPassword.isPending}>
                {t('control.users.password.submit')}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
