import {
  Alert,
  AlertDescription,
  Button,
  DialogBody,
  DialogFooter,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import type { PermissionGroup, Scope } from '@oppenheimer/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PermissionCatalog } from '@/features/api-tokens/components/permission-catalog';
import { PermissionField } from '@/features/api-tokens/components/permission-field';
import {
  hasAnyScope,
  type ScopeSelection,
  scopesFromSelection,
} from '@/features/api-tokens/lib/scope-selection';

export interface CreateApiTokenFormValues {
  name: string;
  scopes: Scope[];
}

/**
 * What the fields hold. Permissions are per resource here and flattened to the
 * `Scope[]` the API takes on submit — see `lib/scope-selection.ts` for why.
 */
type TokenFormFields = {
  name: string;
  permissions: ScopeSelection;
};

const EMPTY_TOKEN_FORM: TokenFormFields = { name: '', permissions: {} };

/**
 * The body of the "Create API key" dialog: a name and the permissions the key
 * grants. It renders the dialog's body and footer so the form element can wrap
 * both, which is what lets the footer's button submit it.
 */
export function CreateApiTokenForm({
  groups,
  grantable,
  loadingCatalog,
  isPending,
  error,
  onCancel,
  onSubmit,
}: {
  groups: readonly PermissionGroup[];
  grantable: readonly Scope[];
  loadingCatalog: boolean;
  isPending: boolean;
  /** The resolved failure message, if the last attempt failed. */
  error?: string;
  onCancel: () => void;
  onSubmit: (values: CreateApiTokenFormValues) => void;
}) {
  const { t } = useTranslation();

  const {
    control,
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<TokenFormFields>({ defaultValues: EMPTY_TOKEN_FORM });

  const [permissionsMessage, setPermissionsMessage] = useState<string>();

  /**
   * The cross-row rule: a key with no scopes can call nothing.
   *
   * Held here rather than on the field because React Hook Form validation
   * descends past `permissions` to the rows registered under it: neither a rule
   * nor a `setError` on the parent path survives. It runs from both arms of
   * `handleSubmit`, so an empty form reports this *and* the missing name in one
   * pass. `PermissionField` stops showing it the moment a row is granted.
   */
  const permissionsGranted = () => {
    if (hasAnyScope(getValues('permissions'))) {
      setPermissionsMessage(undefined);
      return true;
    }
    setPermissionsMessage(t('apiTokens.permissionsRequired'));
    return false;
  };

  const submit = handleSubmit((values) => {
    if (!permissionsGranted()) return;
    onSubmit({ name: values.name, scopes: scopesFromSelection(groups, values.permissions) });
  }, permissionsGranted);

  return (
    <form
      id="create-api-key"
      onSubmit={submit}
      noValidate
      className="flex min-h-0 flex-auto flex-col gap-5"
    >
      <DialogBody>
        <FieldGroup>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="api-key-name">{t('settings.api.keyName')}</FieldLabel>
            <Input
              {...register('name', { required: t('validation.required') })}
              id="api-key-name"
              placeholder={t('settings.api.keyNamePlaceholder')}
              maxLength={80}
              aria-invalid={Boolean(errors.name)}
              disabled={isPending}
            />
            <FieldDescription>{t('settings.api.keyNameHint')}</FieldDescription>
            <FieldError errors={[errors.name]} />
          </Field>

          <PermissionField
            control={control}
            name="permissions"
            label={t('settings.api.keyPermissions')}
            hint={t('settings.api.keyPermissionsHint')}
            message={permissionsMessage}
          >
            {loadingCatalog ? (
              <p className="text-sm text-ink-600">{t('common.loading')}</p>
            ) : (
              <PermissionCatalog
                groups={groups}
                grantable={grantable}
                control={control}
                name="permissions"
                disabled={isPending}
              />
            )}
          </PermissionField>
        </FieldGroup>
      </DialogBody>
      <DialogFooter className="border-t border-border-subtle pt-5">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          {t('settings.api.cancel')}
        </Button>
        <Button type="submit" disabled={isPending || loadingCatalog}>
          {t('settings.api.create')}
        </Button>
      </DialogFooter>
    </form>
  );
}
