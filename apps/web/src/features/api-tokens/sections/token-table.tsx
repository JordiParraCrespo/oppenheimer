import { Badge, DropdownMenuItem } from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import type { ApiTokenEntity } from '@oppenheimer/frontend-consumer';
import { useRevokeApiToken } from '@oppenheimer/frontend-consumer/react';
import {
  DataTable,
  type DataTableColumn,
  formatMediumDate,
  paginateRows,
  useLocale,
  useTableQuery,
} from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { TokenStatusBadge } from '@/features/api-tokens/components/token-status-badge';
import { TOKEN_PAGE_SIZE } from '@/features/api-tokens/lib/token-status';

export function TokenTable({ tokens, loading }: { tokens: ApiTokenEntity[]; loading: boolean }) {
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
      render: (token) => <TokenStatusBadge status={token.status} />,
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
