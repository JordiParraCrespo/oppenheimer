import { ChatTranscript, Skeleton } from '@oppenheimer/design-system-web';

/** A reply as it usually falls, as line widths. */
const FIRST_REPLY = ['w-11/12', 'w-full', 'w-3/5'];
const SECOND_REPLY = ['w-4/5', 'w-2/3'];

/**
 * A bot's chat before its conversation answers: a faint ghost of the turns
 * to come on the transcript's own column, your message a bubble on the right
 * at its 15px line, the bot's reply as prose lines of varied widths on the
 * left, fading as it goes down. Hidden from assistive technology: the screen
 * or section that draws it says it is loading.
 */
export function BotTranscriptSkeleton() {
  return (
    <ChatTranscript aria-hidden>
      <div className="flex justify-end pt-2 opacity-80">
        <span className="flex h-12 w-60 items-center rounded-xl bg-card px-5">
          <Skeleton shape="sm" className="h-3 w-full" />
        </span>
      </div>
      <div className="flex flex-col opacity-60">
        {FIRST_REPLY.map((width, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity.
          <span key={index} className="flex h-6 items-center">
            <Skeleton shape="sm" className={`h-3 ${width}`} />
          </span>
        ))}
      </div>
      <div className="flex justify-end pt-2 opacity-40">
        <span className="flex h-12 w-44 items-center rounded-xl bg-card px-5">
          <Skeleton shape="sm" className="h-3 w-full" />
        </span>
      </div>
      <div className="flex flex-col opacity-20">
        {SECOND_REPLY.map((width, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a line's place is its identity.
          <span key={index} className="flex h-6 items-center">
            <Skeleton shape="sm" className={`h-3 ${width}`} />
          </span>
        ))}
      </div>
    </ChatTranscript>
  );
}
