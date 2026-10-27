import { ChatCodeBlock, ChatJsonBlock } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { HighlightedCode, type MarkdownCodeBlock } from '../../markdown';
import { useJsonView } from '../hooks/use-json-view';

/**
 * A fenced block in an agent's reply, for `Markdown`'s `code` slot: its
 * language over the code, coloured, numbered, with Copy. A block that holds
 * JSON opens as a tree instead (Tree / Raw on its band), each ISO time in it
 * followed by the same instant in words.
 */
export function ChatCode({ code, language }: MarkdownCodeBlock) {
  const { t } = useTranslation();
  const labels = { copy: t('common.copyCode'), copied: t('common.copied') };
  const json = useJsonView(code, language);
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
      {...json}
      language={language}
      labels={{ ...labels, tree: t('common.chat.json.tree'), raw: t('common.chat.json.raw') }}
    >
      <HighlightedCode code={code} language={language ?? 'json'} />
    </ChatJsonBlock>
  );
}
