import { ChatReply, StreamingCaret } from '@oppenheimer/design-system-web';
import { Markdown } from '@oppenheimer/frontend-web';

/**
 * What the bot said, as the markdown it wrote: headings, lists, tables, code
 * with a copy button, links to a new tab. `streaming` puts the write head
 * after the last word, for text a running turn is still writing.
 */
export function BotReply({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <ChatReply>
      <Markdown source={content} caret={streaming ? <StreamingCaret /> : undefined} />
    </ChatReply>
  );
}
