import { JsonTree } from '@oppenheimer/design-system-web';
import { useJsonTimeNote } from '../hooks/use-json-time-note';
import { readJsonBlock } from '../lib/json-block';

/**
 * What a tool call returned, for the fold under its row: a JSON object or
 * array (what an MCP server answers) as a `JsonTree`, each ISO time in it
 * followed by the instant in words; anything else as the text it is. Output
 * the host cut short is not JSON any more, so it stays text.
 */
export function ChatToolOutput({ text }: { text: string }) {
  const timeNote = useJsonTimeNote();
  const json = readJsonBlock(text, undefined);
  if (!json) return text;
  return (
    <JsonTree
      value={json.value}
      annotate={timeNote}
      className="text-[12px] leading-[1.55] text-term-fg"
    />
  );
}
