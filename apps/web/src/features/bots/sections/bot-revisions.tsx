import { Button, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import {
  useRevertBotDocument,
  useSuspenseBotRevisions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, formatDateTime, useLocale } from '@oppenheimer/frontend-web';
import type { BotDocumentName } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_FILE } from '@/features/bots/lib/document-files';
import { revisionNote } from '@/features/bots/lib/revision-note';

/**
 * One document's revision history, newest first: who wrote each (you or the
 * bot), what it did, the file, its number and when; the newest is Current
 * and every other one has Revert, which writes its text as the next revision
 * so nothing is lost.
 */
export function BotRevisions({ botId, name }: { botId: string; name: BotDocumentName }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { data: revisions, error } = useSuspenseBotRevisions(botId, name);
  const revert = useRevertBotDocument();
  const reverting = revert.isPending ? revert.variables.revision : null;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow m-0 px-1">{t('bots.settings.instructions.history')}</h2>
      <ErrorAlert error={error} fallback={t('bots.settings.instructions.historyFailed')} />
      <ErrorAlert
        error={revert.error}
        fallback={t('bots.settings.instructions.revertFailed')}
        onDismiss={() => revert.reset()}
      />
      <SettingsGroup>
        {revisions.map((revision, index) => (
          <SettingsListRow
            key={revision.id}
            align="center"
            lead={
              revision.author === 'user'
                ? t('bots.settings.instructions.you')
                : t('bots.settings.instructions.bot')
            }
            meta={t('bots.settings.instructions.meta', {
              file: DOCUMENT_FILE[revision.name],
              revision: revision.revision,
              when: formatDateTime(revision.createdAt, locale),
            })}
            actions={
              index === 0 ? (
                t('bots.settings.instructions.current')
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  pending={reverting === revision.revision}
                  pendingLabel={t('bots.settings.instructions.reverting')}
                  disabled={reverting !== null && reverting !== revision.revision}
                  onClick={() => revert.mutate({ id: botId, name, revision: revision.revision })}
                >
                  {t('bots.settings.instructions.revert')}
                </Button>
              )
            }
          >
            {revisionNote(revision, t)}
          </SettingsListRow>
        ))}
      </SettingsGroup>
    </section>
  );
}
