import { Alert, AlertDescription, Button } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useApiTokens, useRevokeApiToken } from '@oppenheimer/frontend-consumer/react';
import {
  GroupHeading,
  SectionCard,
  SectionHead,
  SectionRow,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiTokenRow } from '@/features/api-tokens/components/api-token-row';
import { CreateApiTokenDialog } from '@/features/api-tokens/dialogs/create-api-token';
import { SecretDialog } from '@/features/api-tokens/dialogs/secret';

/** The settings screen's API pane: the workspace's keys, with create and revoke. */
export function ApiKeysSection() {
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
          <ApiTokenRow
            key={token.id}
            token={token}
            revoking={revoke.isPending}
            onRevoke={(id) => revoke.mutate(id)}
          />
        ))}
      </SectionCard>

      {creating && (
        <CreateApiTokenDialog
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
