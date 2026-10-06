import { IconButton, useCopy } from '@oppenheimer/design-system-web';
import { CheckIcon, CopyIcon } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type CodeNode, highlightCode, syntaxClass } from '../lib/highlight';

function codeNodes(nodes: CodeNode[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.type === 'text') return node.value;
    if (node.type !== 'element') return null;
    return (
      <span key={key} className={syntaxClass(node.properties.className)}>
        {codeNodes(node.children as CodeNode[], key)}
      </span>
    );
  });
}

/** A fenced block of a description: the code as written, its syntax coloured, a copy button in its corner. */
export function MarkdownCode({ code, language }: { code: string; language?: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(code);
  const highlighted = highlightCode(code, language);
  return (
    <div className="relative">
      <pre data-language={language || undefined}>
        <code>{highlighted ? codeNodes(highlighted, 'code') : code}</code>
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
