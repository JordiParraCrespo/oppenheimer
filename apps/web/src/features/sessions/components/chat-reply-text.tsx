import { ChatReply } from '@oppenheimer/design-system-web';
import { ChatCode, Markdown } from '@oppenheimer/frontend-web';

/** What the agent said, as the markdown it wrote, unboxed across the chat's column. */
export function ChatReplyText({ text }: { text: string }) {
  return (
    <ChatReply>
      <Markdown
        source={text}
        code={(block) => <ChatCode code={block.code} language={block.language} />}
      />
    </ChatReply>
  );
}
