import type { BotDocumentRevisionEntity } from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { DOCUMENT_FILE } from './document-files';

/** What a revision did, in words, when its writer left no note. */
export function revisionNote(revision: BotDocumentRevisionEntity, t: TFunction): string {
  if (revision.note) return revision.note;
  if (revision.revertedFrom !== null) {
    return t('bots.settings.instructions.reverted', { revision: revision.revertedFrom });
  }
  if (revision.revision === 1) return t('bots.settings.instructions.created');
  return t('bots.settings.instructions.edited', { file: DOCUMENT_FILE[revision.name] });
}
