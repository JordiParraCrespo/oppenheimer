import {
  Alert,
  AlertDescription,
  Badge,
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  SearchInput,
} from '@oppenheimer/design-system-web';
import { Cpu, KeyRound, Plus } from '@oppenheimer/design-system-web/icons';
import type { ApiTokenEntity } from '@oppenheimer/frontend';
import {
  useApiTokens,
  useCreateApiToken,
  usePermissionCatalog,
  useRevokeApiToken,
} from '@oppenheimer/frontend/react';
import type { Scope } from '@oppenheimer/shared';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { PermissionPicker } from '@/components/permission-picker';
import {
  CodeBox,
  GroupHeading,
  RowControl,
  SectionCard,
  SectionHead,
  SectionRow,
} from '@/components/section-ui';
import { dateFormatter } from '@/lib/format-date';
import { useErrorMessage } from '@/lib/use-error-message';
import { useLocale } from '@/lib/use-locale';

export function ApiSection() {
  const { t } = useTranslation();

  return (
    <>
      <SectionHead title={t('settings.api.title')} sub={t('settings.api.description')} />
      <ApiKeysCard />
    </>
  );
}

function ApiKeysCard() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const tokens = useApiTokens();
  const revoke = useRevokeApiToken();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const locale = useLocale();
  const date = dateFormatter(locale, { dateStyle: 'medium' });

  return (
    <>
      <GroupHeading
        action={
          <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            {t('settings.api.createKey')}
          </Button>
        }
      >
        {t('settings.api.keys')}
      </GroupHeading>

      {(tokens.error || revoke.error) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(tokens.error ?? revoke.error).message}</AlertDescription>
        </Alert>
      )}

      <SectionCard className="mb-8">
        {tokens.isLoading && (
          <SectionRow>
            <span className="text-sm text-ink-600">{t('common.loading')}</span>
          </SectionRow>
        )}

        {tokens.data?.length === 0 && (
          <SectionRow>
            <span className="text-sm text-ink-600">{t('settings.api.noKeys')}</span>
          </SectionRow>
        )}

        {tokens.data?.map((token) => (
          <SectionRow key={token.id}>
            <div className="min-w-0 flex-1">
              <div className="text-base font-medium text-ink-900">{token.name}</div>
              <div className="mt-1.5 flex items-center gap-2 font-mono text-[12.5px] tracking-wide text-ink-600">
                {/* Only the prefix survives creation — the rest of the secret is
                    stored as a digest, so the dots stand for what nobody can
                    read back, not for something being hidden. */}
                <span className="truncate">{token.prefix}••••••••••••••••••</span>
              </div>
              <div className="mt-[7px] text-xs text-ink-400">
                {t('settings.api.keyCreated', {
                  created: date.format(token.createdAt),
                  used: token.lastUsedAt
                    ? date.format(token.lastUsedAt)
                    : t('settings.api.neverUsed'),
                })}
              </div>
            </div>
            <RowControl>
              <TokenStatus token={token} />
              {token.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(token.id)}
                >
                  {t('settings.api.revoke')}
                </Button>
              )}
            </RowControl>
          </SectionRow>
        ))}
      </SectionCard>

      {creating && (
        <CreateKeyDialog
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setCreating(false);
            setSecret(created);
          }}
        />
      )}

      {secret && (
        <SecretDialog
          title={t('settings.api.secretTitle')}
          subtitle={t('settings.api.secretSubtitle')}
          secret={secret}
          onClose={() => setSecret(null)}
        />
      )}
    </>
  );
}

function TokenStatus({ token }: { token: ApiTokenEntity }) {
  const { t } = useTranslation();

  if (token.status === 'revoked') return <Badge variant="ended">{t('settings.api.revoked')}</Badge>;
  if (token.status === 'expired')
    return <Badge variant="paused">{t('settings.api.expired')}</Badge>;
  return null;
}

interface CreateKeyFormValues {
  name: string;
  scopes: Scope[];
}

/**
 * The design's "Create API key" modal, plus the one thing it does not show: a
 * key with no scopes can call nothing, so the permissions it grants are chosen
 * here rather than defaulted behind the reader's back.
 */
function CreateKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (secret: string) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const catalog = usePermissionCatalog();
  const create = useCreateApiToken();
  const [permissionSearch, setPermissionSearch] = useState('');

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateKeyFormValues>({ defaultValues: { name: '', scopes: [] } });

  const onSubmit = handleSubmit(({ name, scopes }) => {
    create.mutate(
      { name, scopes, expiresInDays: null },
      { onSuccess: ({ secret }) => onCreated(secret) },
    );
  });
  const normalizedPermissionSearch = permissionSearch.trim().toLocaleLowerCase();
  const visiblePermissionGroups = (catalog.data?.groups ?? []).filter((group) =>
    [group.label, group.description, group.levels.read.description, group.levels.write.description]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedPermissionSearch),
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHero gradient="blueLilac">
          <DialogHeroPlate>
            <KeyRound />
          </DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{t('settings.api.createKeyTitle')}</DialogTitle>
          <DialogDescription>{t('settings.api.createKeySubtitle')}</DialogDescription>
        </DialogHeader>
        <form
          id="create-api-key"
          onSubmit={onSubmit}
          noValidate
          className="flex min-h-0 flex-auto flex-col gap-5"
        >
          <DialogBody>
            <FieldGroup>
              {create.error && (
                <Alert variant="destructive">
                  <AlertDescription>{resolveError(create.error).message}</AlertDescription>
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
                  disabled={create.isPending}
                />
                <FieldDescription>{t('settings.api.keyNameHint')}</FieldDescription>
                <FieldError errors={[errors.name]} />
              </Field>

              <Controller
                control={control}
                name="scopes"
                rules={{
                  validate: (value) => value.length > 0 || t('validation.required'),
                }}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>{t('settings.api.keyPermissions')}</FieldLabel>
                    {catalog.isLoading ? (
                      <p className="text-sm text-ink-600">{t('common.loading')}</p>
                    ) : (
                      <>
                        <SearchInput
                          value={permissionSearch}
                          onChange={(event) => setPermissionSearch(event.target.value)}
                          placeholder={t('settings.api.searchPermissions')}
                          aria-label={t('settings.api.searchPermissions')}
                          hint={null}
                          containerClassName="w-full"
                          disabled={create.isPending}
                        />
                        {visiblePermissionGroups.length > 0 ? (
                          // No scroll cap of its own: the dialog body already
                          // scrolls, and a picker that scrolled inside it gave
                          // the card two scrollbars and a wheel that stopped at
                          // the picker's edge.
                          <PermissionPicker
                            groups={visiblePermissionGroups}
                            grantable={catalog.data?.grantable ?? []}
                            value={field.value}
                            onChange={field.onChange}
                            disabled={create.isPending}
                          />
                        ) : (
                          <EmptyState className="border border-border-subtle py-6">
                            <EmptyState.Header>
                              <EmptyState.Title>
                                {t('settings.api.noPermissionResults')}
                              </EmptyState.Title>
                            </EmptyState.Header>
                          </EmptyState>
                        )}
                      </>
                    )}
                    <FieldDescription>{t('settings.api.keyPermissionsHint')}</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
          </DialogBody>
          <DialogFooter className="border-t border-border-subtle pt-5">
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              {t('settings.api.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || catalog.isLoading}>
              {t('settings.api.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The one and only time a secret exists outside the server.
 *
 * Dismissed by an explicit click rather than by clicking away, so it cannot be
 * lost to a stray tap on the backdrop.
 */
function SecretDialog({
  title,
  subtitle,
  secret,
  onClose,
}: {
  title: string;
  subtitle: string;
  secret: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingsDialog
      icon={<Cpu />}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <Button type="button" onClick={onClose}>
          {t('settings.api.close')}
        </Button>
      }
    >
      <CodeBox value={secret} />
    </SettingsDialog>
  );
}

/** The design's modal shell: icon tile, title, subtitle, body, divided footer. */
function SettingsDialog({
  icon,
  title,
  subtitle,
  children,
  footer,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHero gradient="blueLilac">
          <DialogHeroPlate>{icon}</DialogHeroPlate>
        </DialogHero>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {/* The body is the only part that scrolls, so a long one (the permission
            list) never pushes the footer off-screen. */}
        <DialogBody>{children}</DialogBody>
        <DialogFooter className="border-t border-border-subtle pt-5">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
