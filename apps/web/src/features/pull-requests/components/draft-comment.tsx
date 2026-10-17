import { DiffCommentDraft } from '@oppenheimer/design-system-web';
import {
  dictateInto,
  dictationSlots,
  useDictation,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The comment being written on a line: its text is this component's until it
 * is added. It can be dictated.
 */
export function DraftComment({
  voice,
  onAddToReview,
  onAddSingle,
  onCancel,
  adding,
}: {
  voice: VoiceInput;
  onAddToReview: (body: string) => void;
  onAddSingle: (body: string) => void;
  onCancel: () => void;
  adding: boolean;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const dictation = useDictation({
    voice,
    onText: dictateInto(setBody),
  });
  const text = body.trim();
  return (
    <DiffCommentDraft
      value={body}
      onValueChange={setBody}
      onAddToReview={() => text && onAddToReview(text)}
      onAddSingle={adding ? undefined : () => text && onAddSingle(text)}
      onCancel={onCancel}
      dictation={dictationSlots(dictation)}
      labels={{
        placeholder: t('pullRequests.changes.commentPlaceholder'),
        addToReview: t('pullRequests.changes.addToReview'),
        addSingle: t('pullRequests.changes.addSingle'),
        hint: t('pullRequests.changes.hint'),
        cancel: t('pullRequests.changes.cancel'),
      }}
    />
  );
}
