import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  DropdownMenuItem,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import type { ApiTokenEntity } from '@oppenheimer/frontend';
import {
  useApiTokens,
  useCreateApiToken,
  useOrganizations,
  usePermissionCatalog,
  useRevokeApiToken,
} from '@oppenheimer/frontend/react';
import type { Scope } from '@oppenheimer/shared';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PageHead } from '@/components/page-head';
import { PermissionPicker } from '@/components/permission-picker';
import { GroupHeading } from '@/components/section-ui';
import { formatMediumDate } from '@/lib/format-date';
import { paginateRows } from '@/lib/paginate-rows';
import { useCopy } from '@/lib/use-copy';
import { useErrorMessage } from '@/lib/use-error-message';
import { useLocale } from '@/lib/use-locale';
import { useTableQuery } from '@/lib/use-table-query';

export const Route = createFileRoute('/_authenticated/settings/api-tokens')({
  component: ApiTokensPage,
});

/** Lifetimes offered in the form, in days. `null` means "does not expire". */
const LIFETIMES: (number | null)[] = [7, 30, 90, 365, null];

/**
 * Mirrors `CreateApiTokenDto` minus the fields this form does not expose.
 * Declared locally rather than derived from `createApiTokenSchema`, which would
 * pull the scope catalog into the bundle — the page fetches it from the API.
 */
type CreateTokenFormValues = {
  name: string;
  scopes: Scope[];
  expiresInDays: number | null;
  organizationIds: string[];
};

const EMPTY_TOKEN_FORM: CreateTokenFormValues = {
  name: '',
  scopes: [],
  expiresInDays: 90,
  organizationIds: [],
};

function ApiTokensPage() {
  const { t } = useTranslation();
  const tokens = useApiTokens();
  const catalog = usePermissionCatalog();
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <>
      <PageHead title={t('apiTokens.title')} sub={t('apiTokens.description')} />

      <div className="flex flex-col gap-4">
        {secret && <SecretPanel secret={secret} onDismiss={() => setSecret(null)} />}

        <CreateTokenCard
          grantable={catalog.data?.grantable ?? []}
          groups={catalog.data?.groups ?? []}
          loadingCatalog={catalog.isLoading}
          onCreated={setSecret}
        />

        <section>
          {/* The heading sits above the table rather than inside a card of its
              own: `DataTable` brings the card, and nesting one in another gave
              this list a header two rows taller than every other table. */}
          <GroupHeading description={t('apiTokens.yourTokensDescription')}>
            {t('apiTokens.yourTokens')}
          </GroupHeading>
          <TokenTable tokens={tokens.data ?? []} loading={tokens.isLoading} />
        </section>
      </div>
    </>
  );
}

/**
 * The one and only time the secret exists outside the server. Deliberately
 * loud, and dismissed only by an explicit click.
 */
function SecretPanel({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();

  return (
    <Alert>
      <AlertTitle>{t('apiTokens.created')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{t('apiTokens.shownOnce')}</span>
        <code className="block overflow-x-auto rounded bg-surface-sunken px-3 py-2 font-mono text-sm">
          {secret}
        </code>
        <span className="flex gap-2">
          <Button type="button" size="sm" onClick={() => copy(secret)}>
            {copied ? t('apiTokens.copied') : t('apiTokens.copy')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDismiss}>
            {t('apiTokens.dismiss')}
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}

function CreateTokenCard({
  groups,
  grantable,
  loadingCatalog,
  onCreated,
}: {
  groups: Parameters<typeof PermissionPicker>[0]['groups'];
  grantable: Scope[];
  loadingCatalog: boolean;
  onCreated: (secret: string) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const organizations = useOrganizations();
  const create = useCreateApiToken();

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTokenFormValues>({ defaultValues: EMPTY_TOKEN_FORM });

  const onSubmit = handleSubmit(({ name, scopes, expiresInDays, organizationIds }) => {
    create.mutate(
      {
        name,
        scopes,
        expiresInDays,
        organizationIds: organizationIds.length > 0 ? organizationIds : undefined,
      },
      {
        onSuccess: ({ secret }) => {
          onCreated(secret);
          reset(EMPTY_TOKEN_FORM);
        },
      },
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('apiTokens.create')}</CardTitle>
        <CardDescription>{t('apiTokens.createDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {create.error && (
              <Alert variant="destructive">
                <AlertDescription>{resolveError(create.error).message}</AlertDescription>
              </Alert>
            )}

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="token-name">{t('apiTokens.name')}</FieldLabel>
              <Input
                {...register('name', {
                  required: t('validation.required'),
                  maxLength: {
                    value: 80,
                    message: t('validation.maxLength', { max: 80 }),
                  },
                })}
                id="token-name"
                placeholder={t('apiTokens.namePlaceholder')}
                maxLength={80}
                aria-invalid={Boolean(errors.name)}
                disabled={create.isPending}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Controller
              control={control}
              name="scopes"
              rules={{
                validate: (value) => value.length > 0 || t('apiTokens.permissionsRequired'),
              }}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>{t('apiTokens.permissions')}</FieldLabel>
                  {loadingCatalog ? (
                    <p className="text-sm text-ink-600">{t('common.loading')}</p>
                  ) : (
                    <PermissionPicker
                      groups={groups}
                      grantable={grantable}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={create.isPending}
                    />
                  )}
                  <p className="text-xs text-ink-600">{t('apiTokens.permissionsHint')}</p>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={control}
              name="expiresInDays"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="token-expiry">{t('apiTokens.expiry')}</FieldLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(next) => field.onChange(next === 'null' ? null : Number(next))}
                    disabled={create.isPending}
                  >
                    <SelectTrigger id="token-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFETIMES.map((days) => (
                        <SelectItem key={String(days)} value={String(days)}>
                          {days === null
                            ? t('apiTokens.never')
                            : t('apiTokens.days', { count: days })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {organizations.data && organizations.data.length > 0 && (
              <Controller
                control={control}
                name="organizationIds"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>{t('apiTokens.organizations')}</FieldLabel>
                    <p className="text-xs text-ink-600">{t('apiTokens.organizationsHint')}</p>
                    <div className="flex flex-col gap-2">
                      {organizations.data.map((organization) => (
                        <div key={organization.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`org-${organization.id}`}
                            checked={field.value.includes(organization.id)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked
                                  ? [...field.value, organization.id]
                                  : field.value.filter((id) => id !== organization.id),
                              )
                            }
                            disabled={create.isPending}
                          />
                          <Label
                            htmlFor={`org-${organization.id}`}
                            className="cursor-pointer text-sm"
                          >
                            {organization.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </Field>
                )}
              />
            )}

            <Separator />

            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('common.loading') : t('apiTokens.createButton')}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

/** The design's tokens table shows eight rows before it pages. */
const TOKEN_PAGE_SIZE = 8;

function TokenTable({ tokens, loading }: { tokens: ApiTokenEntity[]; loading: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const revoke = useRevokeApiToken();

  // Only the page is in the URL here: the list is short, has no search and no
  // filter, and the one thing worth linking to is a row further down it.
  const query = useTableQuery({ prefix: 'tokens' });
  const page = paginateRows(tokens, TOKEN_PAGE_SIZE, query);

  const columns: DataTableColumn<ApiTokenEntity>[] = [
    {
      key: 'name',
      label: t('apiTokens.name'),
      width: 200,
      render: (token) => <span className="font-medium">{token.name}</span>,
    },
    {
      key: 'prefix',
      label: t('apiTokens.prefix'),
      width: 120,
      render: (token) => (
        // Only the prefix survives creation — the rest is stored as a digest,
        // so there is nothing else to show.
        <span className="font-mono text-xs tracking-wide text-ink-600">{token.prefix}…</span>
      ),
    },
    {
      key: 'permissions',
      label: t('apiTokens.permissions'),
      width: 320,
      render: (token) => (
        <span className="flex max-w-[320px] flex-wrap gap-1">
          {token.scopes.map((scope) => (
            <Badge key={scope} variant="neutral" className="font-mono text-xs">
              {scope}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('apiTokens.status'),
      width: 120,
      render: (token) => <StatusBadge status={token.status} />,
    },
    {
      key: 'lastUsed',
      label: t('apiTokens.lastUsed'),
      width: 140,
      align: 'right',
      render: (token) => (
        <span className="text-ink-400">
          {token.lastUsedAt ? formatMediumDate(token.lastUsedAt, locale) : t('apiTokens.neverUsed')}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={page.rows}
      pagination={page.pagination}
      getKey={(token) => token.id}
      isLoading={loading}
      // A revoked token cannot be un-revoked, and revoking a handful at once is
      // not something anyone asked for — so there is no selection here.
      selectable={false}
      emptyLabel={t('apiTokens.empty')}
      emptyIcon={<Cpu />}
      rowActions={(token) =>
        // A revoked or expired token has nothing left to do to it, and a menu
        // whose only item is disabled says less than no menu at all.
        token.isActive ? (
          <DropdownMenuItem
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(token.id)}
          >
            {t('apiTokens.revoke')}
          </DropdownMenuItem>
        ) : null
      }
    />
  );
}

/**
 * The token's lifecycle on the brand's status set, the same way
 * `DomainStatusBadge` reads a domain's. `expired` is `paused` rather than
 * `ended`: it stopped working on its own and can be replaced, where `revoked`
 * was a decision someone made.
 */
const TOKEN_STATUS_VARIANT = {
  active: 'active',
  expired: 'paused',
  revoked: 'ended',
} as const satisfies Record<ApiTokenEntity['status'], 'active' | 'paused' | 'ended'>;

const TOKEN_STATUS_LABEL = {
  active: 'apiTokens.active',
  expired: 'apiTokens.expired',
  revoked: 'apiTokens.revoked',
} as const satisfies Record<ApiTokenEntity['status'], string>;

function StatusBadge({ status }: { status: ApiTokenEntity['status'] }) {
  const { t } = useTranslation();

  return <Badge variant={TOKEN_STATUS_VARIANT[status]}>{t(TOKEN_STATUS_LABEL[status])}</Badge>;
}
