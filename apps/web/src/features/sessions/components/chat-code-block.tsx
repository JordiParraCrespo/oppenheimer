import { ChatCodeBlock as Block } from '@oppenheimer/design-system-web';
import { HighlightedCode, type MarkdownCodeBlock } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** A fenced block in the agent's reply: its language over the code, coloured, numbered, with Copy. */
export function ChatCodeBlock({ code, language }: MarkdownCodeBlock) {
  const { t } = useTranslation();
  return (
    <Block
      code={code}
      language={language}
      labels={{ copy: t('common.copyCode'), copied: t('common.copied') }}
    >
      <HighlightedCode code={code} language={language} />
    </Block>
  );
}
