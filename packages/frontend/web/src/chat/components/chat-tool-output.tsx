import { JsonTree, ToolCallOutput } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useJsonView } from '../hooks/use-json-view';

/**
 * What a tool call returned, for the fold under its row: a JSON object or
 * array (what an MCP server answers) as a `JsonTree`; anything else as its
 * text, compact: its first lines, a line too long to read cut to its head
 * and tail, and "+N lines" that shows the rest. Output the host cut short is
 * not JSON any more, so it stays text.
 */
export function ChatToolOutput({ text }: { text: string }) {
  const { t } = useTranslation();
  const json = useJsonView(text);
  if (!json) {
    return (
      <ToolCallOutput
        labels={{
          more: (count) => t('common.chat.output.more', { count }),
          full: t('common.chat.output.full'),
          less: t('common.chat.output.less'),
        }}
      >
        {text}
      </ToolCallOutput>
    );
  }
  return <JsonTree {...json} className="text-[12px] leading-[1.55] text-term-fg" />;
}
