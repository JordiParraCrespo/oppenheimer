import { IconButton, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** A fenced block of a description: the code as written, a copy button in its corner. */
export function MarkdownCode({ code, language }: { code: string; language?: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(code);
  return (
    <div className="relative">
      <pre data-language={language || undefined}>
        <code>{code}</code>
      </pre>
      <IconButton
        size="xs"
        shape="square"
        className="absolute top-2 right-2"
        aria-label={
          copied ? t('pullRequests.detail.codeCopied') : t('pullRequests.detail.copyCode')
        }
        onClick={copy}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </IconButton>
    </div>
  );
}
