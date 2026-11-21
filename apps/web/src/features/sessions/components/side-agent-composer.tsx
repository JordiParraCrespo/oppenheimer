import { ChatComposer } from '@oppenheimer/design-system-web';
import { ComposerEmojiMenu, useEmojiMenu } from '@oppenheimer/frontend-web';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The second agent's first task, in the chat's one-row box (a bot's chat
 * beside a session draws the same): what is typed is the task, Enter or send
 * starts the agent with it, and an empty box starts it with none. `tools`
 * (the permission) and `engine` (agent, model, effort) sit in the quiet line
 * under the box, made by the picker: the draft is this component's alone, so
 * a keystroke redraws the box and never the chips.
 */
export function SideAgentComposer({
  onSubmit,
  sendLabel,
  starting,
  tools,
  engine,
}: {
  onSubmit: (task: string) => void;
  /** What send says: "Start Claude Code". */
  sendLabel: string;
  /** The agent is being started: the box keeps its text and sends nothing. */
  starting: boolean;
  tools: ReactNode;
  engine: ReactNode;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const emoji = useEmojiMenu(draft, setDraft);

  return (
    <div className="relative" onKeyDownCapture={emoji.onKeyDownCapture} {...emoji.track}>
      {emoji.rows ? (
        <ComposerEmojiMenu
          rows={emoji.rows}
          left={emoji.left}
          highlighted={emoji.highlighted}
          onPick={emoji.pick}
        />
      ) : null}
      <ChatComposer
        layout="inline"
        value={draft}
        onValueChange={setDraft}
        onSubmit={() => onSubmit(draft.trim())}
        allowEmpty
        disabled={starting}
        placeholder={t('sessions.new.composer.placeholder')}
        tools={tools}
        engine={engine}
        labels={{
          send: sendLabel,
          stop: t('bots.chat.stop'),
          attach: t('bots.chat.images.attach'),
        }}
      />
    </div>
  );
}
