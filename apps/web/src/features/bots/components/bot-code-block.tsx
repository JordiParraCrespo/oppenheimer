import { ChatCodeBlock } from '@oppenheimer/design-system-web';
import { HighlightedCode, type MarkdownCodeBlock } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/** A fenced block in the bot's reply: its language over the code, coloured, numbered, with Copy. */
export function BotCodeBlock({ code, language }: MarkdownCodeBlock) {
  const { t } = useTranslation();
  return (
    <ChatCodeBlock
      code={code}
      language={language}
      labels={{ copy: t('common.copyCode'), copied: t('common.copied') }}
    >
      <HighlightedCode code={code} language={language} />
    </ChatCodeBlock>
  );
}
