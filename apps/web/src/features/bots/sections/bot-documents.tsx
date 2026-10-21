import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web';
import { useSuspenseBotDocuments } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import type { BotDocumentName } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotRevisionsSkeleton } from '@/features/bots/components/bot-revisions-skeleton';
import { DOCUMENT_FILE } from '@/features/bots/lib/document-files';
import { BotDocumentEditor } from './bot-document-editor';
import { BotRevisions } from './bot-revisions';

/**
 * Settings → Instructions below its title: which file (SOUL.md or
 * INSTRUCTIONS.md) and what it is for, its editor, and its revision history.
 * The editor is keyed by the file and the revision it opened on, so a save, a
 * revert or a reload after a conflict opens it afresh on what the server
 * holds; until then a draft is the editor's own.
 */
export function BotDocuments({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: documents, error } = useSuspenseBotDocuments(botId);
  const [file, setFile] = useState<BotDocumentName>('instructions');
  const document = documents.find((row) => row.name === file);

  return (
    <div className="flex flex-col gap-7">
      <ErrorAlert error={error} fallback={t('bots.settings.instructions.loadFailed')} />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <SegmentedControl
            size="md"
            value={file}
            onValueChange={(next) => setFile(next === 'soul' ? 'soul' : 'instructions')}
            aria-label={t('bots.settings.instructions.file')}
          >
            <SegmentedControlItem value="soul" mono>
              {DOCUMENT_FILE.soul}
            </SegmentedControlItem>
            <SegmentedControlItem value="instructions" mono>
              {DOCUMENT_FILE.instructions}
            </SegmentedControlItem>
          </SegmentedControl>
          <span className="text-sm text-fg-subtle">
            {file === 'soul'
              ? t('bots.settings.instructions.soulHint')
              : t('bots.settings.instructions.instructionsHint')}
          </span>
        </div>
        {document ? (
          <BotDocumentEditor
            key={`${document.name}:${document.revision}`}
            botId={botId}
            document={document}
          />
        ) : null}
      </div>
      <QueryState key={file}>
        <QueryState.Pending>
          <BotRevisionsSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.settings.instructions.historyFailed')} />
        <QueryState.Data>
          <BotRevisions botId={botId} name={file} />
        </QueryState.Data>
      </QueryState>
    </div>
  );
}
