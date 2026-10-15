import { ChatReply, StreamingCaret } from '@oppenheimer/design-system-web';
import { replyParagraphs } from '@/features/bots/lib/chat-turns';

/**
 * What the bot said, a paragraph per blank line. `streaming` puts the write
 * head after the last word, for text a running turn is still writing.
 */
export function BotReply({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const paragraphs = replyParagraphs(content);
  const last = paragraphs.length - 1;
  return (
    <ChatReply className="whitespace-pre-wrap">
      {paragraphs.map((paragraph, index) => (
        // A reply is never reordered, so a paragraph's place is its identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: see above
        <p key={index}>
          {paragraph}
          {streaming && index === last ? <StreamingCaret /> : null}
        </p>
      ))}
      {streaming && last < 0 ? (
        <p>
          <StreamingCaret />
        </p>
      ) : null}
    </ChatReply>
  );
}
