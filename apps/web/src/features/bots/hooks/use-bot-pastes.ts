import { useStoredText } from '@oppenheimer/frontend-web';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  botPastes,
  botPasteTexts,
  collapsesPaste,
  deletePasteLabel,
  expandPastes,
  nextPasteNumber,
  pasteLines,
  setBotPastes,
} from '@/features/bots/lib/bot-pastes';

/**
 * The long pastes a bot's draft holds (`bot-pastes`): `onPaste` puts a long
 * paste in the field as its label, at the caret or over the selection, and
 * keeps its text; `onKeyDownCapture` takes a label out whole on Backspace or
 * Delete and says whether it did; `content` is the draft as it is sent, each
 * label still in it replaced by its text. `clear` forgets them, on a send.
 */
export function useBotPastes(botId: string, draft: string, setDraft: (next: string) => void) {
  const { t } = useTranslation();
  // Subscribes to this bot's pastes; `botPastes` reads them, parsed once per change.
  useStoredText(botPasteTexts, botId);
  const pastes = botPastes(botId);

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement)) return;
    const text = event.clipboardData.getData?.('text/plain') ?? '';
    if (!collapsesPaste(text)) return;
    event.preventDefault();
    const n = nextPasteNumber(pastes);
    const lines = pasteLines(text);
    const label =
      lines > 1
        ? t('bots.chat.pasted.lines', { n, lines })
        : t('bots.chat.pasted.chars', { n, chars: text.length });
    setBotPastes(botId, [...pastes, { n, label, text }]);
    field.setRangeText(label, field.selectionStart, field.selectionEnd, 'end');
    setDraft(field.value);
  }

  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>): boolean {
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement) || pastes.length === 0) return false;
    if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false;
    const range = deletePasteLabel(
      field.value,
      field.selectionStart,
      field.selectionEnd,
      event.key,
      pastes,
    );
    if (!range) return false;
    event.preventDefault();
    field.setRangeText('', range.start, range.end, 'end');
    setDraft(field.value);
    return true;
  }

  return {
    content: expandPastes(draft, pastes),
    onPaste,
    onKeyDownCapture,
    clear: () => setBotPastes(botId, []),
  };
}
