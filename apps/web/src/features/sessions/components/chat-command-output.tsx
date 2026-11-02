import { cn, ToolCallOutput } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** Lines drawn before "+N lines": enough for `/context` whole, a long listing folds. */
const COMMAND_OUTPUT_LINES = 40;

/**
 * What a command the CLI answers itself printed (`/context`, `/cost`), under
 * the prompt that ran it: on the terminal's ground, in its font, with its
 * spacing kept, since the output is laid out in columns. Stderr is red.
 */
export function ChatCommandOutput({ text, failed }: { text: string; failed: boolean }) {
  const { t } = useTranslation();
  return (
    <pre
      className={cn(
        'm-0 overflow-x-auto rounded-sm bg-term-bg px-3 py-2.5 font-mono text-[12px] leading-[1.55]',
        failed ? 'text-danger' : 'text-term-fg',
      )}
    >
      <ToolCallOutput
        maxLines={COMMAND_OUTPUT_LINES}
        labels={{
          more: (count) => t('common.chat.output.more', { count }),
          full: t('common.chat.output.full'),
          less: t('common.chat.output.less'),
        }}
      >
        {text}
      </ToolCallOutput>
    </pre>
  );
}
