import { inlineParts } from '../lib/markdown';

/** A line of a description, its `inline code` set as code. */
export function InlineText({ text }: { text: string }) {
  return (
    <>
      {inlineParts(text).map((part, index) =>
        part.code ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one line have no identity beyond their place
          <code key={index}>{part.text}</code>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
