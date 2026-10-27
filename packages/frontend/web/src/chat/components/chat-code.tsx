import { ChatCodeBlock, ChatJsonBlock } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { HighlightedCode, type MarkdownCodeBlock } from '../../markdown';
import { useJsonTimeNote } from '../hooks/use-json-time-note';
import { readJsonBlock } from '../lib/json-block';

/**
 * A fenced block in an agent's reply, for `Markdown`'s `code` slot: its
 * language over the code, coloured, numbered, with Copy. A block that holds
 * JSON opens as a tree instead (Tree / Raw on its band), each ISO time in it
 * followed by the same instant in words.
 */
export function ChatCode({ code, language }: MarkdownCodeBlock) {
  const { t } = useTranslation();
  const timeNote = useJsonTimeNote();
  const labels = { copy: t('common.copyCode'), copied: t('common.copied') };
  const json = readJsonBlock(code, language);
  if (!json) {
    return (
      <ChatCodeBlock code={code} language={language} labels={labels}>
        <HighlightedCode code={code} language={language} />
      </ChatCodeBlock>
    );
  }
  return (
    <ChatJsonBlock
      code={code}
      value={json.value}
      language={language}
      labels={{ ...labels, tree: t('common.chat.json.tree'), raw: t('common.chat.json.raw') }}
      annotate={timeNote}
    >
      <HighlightedCode code={code} language={language ?? 'json'} />
    </ChatJsonBlock>
  );
}
