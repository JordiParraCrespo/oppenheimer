import { Composer, ComposerNotice } from '@oppenheimer/design-system-web';
import { Info } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The bot's composer. Until the chat arrives (`25-bots.md`, slice 2) the box
 * takes a draft but send stays off, and the notice fused to its top says why
 * and where to shape the bot meanwhile. It owns the draft alone: the chips in
 * `tools` and `engine` are elements its parent made, so a keystroke renders
 * the field and none of them.
 */
export function BotComposer({
  name,
  tools,
  engine,
}: {
  name: string;
  tools: ReactNode;
  engine: ReactNode;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const reason = t('bots.chat.notYet');

  return (
    <Composer
      value={draft}
      onValueChange={setDraft}
      onSubmit={() => {}}
      sendBlockedReason={reason}
      placeholder={t('bots.chat.placeholder', { name })}
      tools={tools}
      engine={engine}
      above={<ComposerNotice icon={<Info />}>{reason}</ComposerNotice>}
      labels={{ send: t('bots.chat.send'), stop: t('bots.chat.stop') }}
    />
  );
}
