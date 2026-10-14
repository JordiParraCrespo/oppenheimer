import { Button, Textarea } from '@oppenheimer/design-system-web';
import { type BotDocumentEntity, documentConflictRevision } from '@oppenheimer/frontend-consumer';
import { useReloadBotDocuments, useSaveBotDocument } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_DOCUMENT_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_FILE } from '@/features/bots/lib/document-files';

/**
 * One document's editor: the text in mono, and once it differs from what was
 * opened, Discard and Save revision. A save names the revision it was opened
 * on; when somebody saved the file since, the API refuses it, and this says
 * which revision the file is at now and offers Reload, which opens the editor
 * on that one. The draft stays in the box until then, so it can be copied.
 */
export function BotDocumentEditor({
  botId,
  document,
}: {
  botId: string;
  document: BotDocumentEntity;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(document.content);
  const save = useSaveBotDocument();
  const reload = useReloadBotDocuments();
  const file = DOCUMENT_FILE[document.name];
  const dirty = draft !== document.content;
  const conflict = documentConflictRevision(save.error);

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={BOT_DOCUMENT_MAX}
        spellCheck={false}
        aria-label={file}
        placeholder={t('bots.settings.instructions.placeholder', { file })}
        variant="code"
      />
      {conflict !== null ? (
        <ErrorAlert
          message={t('bots.settings.instructions.conflict', { file, revision: conflict })}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                save.reset();
                void reload(botId);
              }}
            >
              {t('bots.settings.instructions.reload')}
            </Button>
          }
        />
      ) : (
        <ErrorAlert
          error={save.error}
          fallback={t('bots.settings.instructions.saveFailed')}
          onDismiss={() => save.reset()}
        />
      )}
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={save.isPending}
            onClick={() => {
              setDraft(document.content);
              save.reset();
            }}
          >
            {t('bots.settings.instructions.discard')}
          </Button>
          <Button
            size="sm"
            pending={save.isPending}
            pendingLabel={t('bots.settings.instructions.saving')}
            onClick={() =>
              save.mutate({
                id: botId,
                name: document.name,
                input: { content: draft, baseRevision: document.revision },
              })
            }
          >
            {t('bots.settings.instructions.save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
