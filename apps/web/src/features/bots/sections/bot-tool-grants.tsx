import { IconButton, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import {
  useDeleteBotToolGrant,
  useSuspenseBotPermissions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * What an "Always allow for …" left standing: one tool on one thing, newest
 * first. Removing one makes the next call on that thing ask again.
 */
export function BotToolGrants({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: permissions } = useSuspenseBotPermissions(botId);
  const remove = useDeleteBotToolGrant();

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow m-0 px-1">{t('bots.settings.permissions.grants')}</h2>
      {/* A refetch that fails is not drawn here: the tools section below draws it once. */}
      <SettingsGroup>
        {permissions.grants.length === 0 ? (
          <SettingsListRow muted>{t('bots.settings.permissions.noGrants')}</SettingsListRow>
        ) : (
          permissions.grants.map((grant) => (
            <SettingsListRow
              key={grant.id}
              align="center"
              kind={<span className="font-mono">{grant.tool}</span>}
              actions={
                <IconButton
                  variant="quiet"
                  size="sm"
                  aria-label={t('bots.settings.permissions.removeGrant', {
                    tool: grant.tool,
                    subject: grant.subjectLabel,
                  })}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: botId, grantId: grant.id })}
                >
                  <X />
                </IconButton>
              }
            >
              {grant.subjectLabel}
            </SettingsListRow>
          ))
        )}
      </SettingsGroup>
      <ErrorAlert
        error={remove.error}
        fallback={t('bots.settings.permissions.saveFailed')}
        onDismiss={() => remove.reset()}
      />
    </section>
  );
}
