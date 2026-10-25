import { Button, Kbd, Textarea } from '@oppenheimer/design-system-web';
import { type BotDocumentEntity, documentConflictRevision } from '@oppenheimer/frontend-consumer';
import {
  useReloadBotDocuments,
  useSaveBotDocument,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { DictationField, dictateInto, ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_DOCUMENT_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_FILE } from '@/features/bots/lib/document-files';

const SAVE_SHORTCUT =
  typeof navigator !== 'undefined' && /^Mac/.test(navigator.platform) ? '⌘S' : 'Ctrl S';

/**
 * One document's editor: the text in mono, and under it the save row, always
 * there: which revision the file is saved at, or that the draft has unsaved
 * changes, and Save revision, enabled once the text differs from what was
 * opened (⌘S or Ctrl+S in the box does the same), with Discard beside it. A save names the revision it was opened
 * on; when somebody saved the file since, the API refuses it, and this says
 * which revision the file is at now and offers Reload, which opens the editor
 * on that one. The draft stays in the box until then, so it can be copied.
 * The mic dictates onto the end of the draft.
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
  const voice = useVoiceDictation();
  const submit = () => {
    if (!dirty || save.isPending) return;
    save.mutate({
      id: botId,
      name: document.name,
      input: { content: draft, baseRevision: document.revision },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <DictationField voice={voice} onText={dictateInto(setDraft)}>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          maxLength={BOT_DOCUMENT_MAX}
          spellCheck={false}
          aria-label={file}
          placeholder={t('bots.settings.instructions.placeholder', { file })}
          variant="code"
        />
      </DictationField>
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
      <div className="flex items-center gap-2">
        <span aria-live="polite" className="flex flex-1 items-center gap-2 text-sm text-fg-subtle">
          {dirty
            ? t('bots.settings.instructions.unsaved')
            : t('bots.settings.instructions.saved', { revision: document.revision })}
          {dirty ? <Kbd className="max-sm:hidden">{SAVE_SHORTCUT}</Kbd> : null}
        </span>
        {dirty ? (
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
        ) : null}
        <Button
          size="sm"
          disabled={!dirty}
          pending={save.isPending}
          pendingLabel={t('bots.settings.instructions.saving')}
          onClick={submit}
        >
          {t('bots.settings.instructions.save')}
        </Button>
      </div>
    </div>
  );
}
