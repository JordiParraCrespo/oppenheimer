import { useApiTokens, usePermissionCatalog } from '@oppenheimer/frontend-consumer/react';
import { GroupHeading, PageHead } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SecretPanel } from '@/features/api-tokens/components/secret-panel';
import { CreateTokenCard } from '@/features/api-tokens/sections/create-token-card';
import { TokenTable } from '@/features/api-tokens/sections/token-table';

export function ApiTokensScreen() {
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
