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

/**
 * Code as written, its syntax coloured for `language` (highlight.js's common
 * set) as spans, the plain text when the language is not one it knows. For
 * a caller that draws the block around it (`ChatCodeBlock`).
 */
export function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const highlighted = highlightCode(code, language);
  return <>{highlighted ? codeNodes(highlighted, 'code') : code}</>;
}

/** A fenced block: the code as written, its syntax coloured, a copy button in its corner. */
export function MarkdownCode({ code, language }: { code: string; language?: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy(code);
  return (
    <div className="relative">
      <pre data-language={language || undefined}>
        <code>
          <HighlightedCode code={code} language={language} />
        </code>
      </pre>
      <IconButton
        size="xs"
        shape="square"
        className="absolute top-2 right-2"
        aria-label={copied ? t('common.copied') : t('common.copyCode')}
        onClick={copy}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </IconButton>
    </div>
  );
}
