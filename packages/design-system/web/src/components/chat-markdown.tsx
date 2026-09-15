import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Stable plugin identity keeps the Markdown pipeline out of message re-renders. */
const REMARK_PLUGINS = [remarkGfm];

/**
 * Safe assistant prose.
 *
 * `react-markdown` builds React nodes instead of injecting HTML, and raw HTML
 * stays disabled. The model can therefore use normal Markdown without gaining
 * a path to executable markup in the workspace.
 */
function ChatMarkdown({ children }: { children: string }) {
  return (
    <div
      data-slot="chat-markdown"
      className="min-w-0 break-words whitespace-normal [&_a]:text-accent-blue [&_a]:underline [&_a]:underline-offset-3 [&_a:hover]:opacity-80 [&_blockquote]:my-3 [&_blockquote]:border-border-subtle [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-ink-600 [&_code]:rounded-sm [&_code]:bg-surface-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_h1]:mb-2 [&_h1]:font-semibold [&_h1]:text-lg [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-base [&_h3]:mb-1.5 [&_h3]:font-semibold [&_li+li]:mt-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p:not(:last-child)]:mb-3 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-sunken [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_table]:my-3 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_td]:border [&_td]:border-border-subtle [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-border-subtle [&_th]:bg-surface-sunken [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
    >
      <Markdown remarkPlugins={REMARK_PLUGINS}>{children}</Markdown>
    </div>
  );
}

export { ChatMarkdown };
