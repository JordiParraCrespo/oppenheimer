import { JsonTree } from '@oppenheimer/design-system-web';
import { useJsonView } from '../hooks/use-json-view';

/**
 * What a tool call returned, for the fold under its row: a JSON object or
 * array (what an MCP server answers) as a `JsonTree`; anything else as the
 * text it is. Output the host cut short is not JSON any more, so it stays text.
 */
export function ChatToolOutput({ text }: { text: string }) {
  const json = useJsonView(text);
  if (!json) return text;
  return <JsonTree {...json} className="text-[12px] leading-[1.55] text-term-fg" />;
}
