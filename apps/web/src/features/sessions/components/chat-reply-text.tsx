import { ChatReply } from '@oppenheimer/design-system-web';
import { Markdown } from '@oppenheimer/frontend-web';
import { ChatCodeBlock } from './chat-code-block';

/** What the agent said, as the markdown it wrote, unboxed across the chat's column. */
export function ChatReplyText({ text }: { text: string }) {
  return (
    <ChatReply>
      <Markdown
        source={text}
        code={(block) => <ChatCodeBlock code={block.code} language={block.language} />}
      />
    </ChatReply>
  );
}
