import { ComposerMenu, ComposerMenuGroup, ComposerMenuItem } from '@oppenheimer/design-system-web';
import { SquareSlash, Target } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SlashCommand } from '@/features/bots/lib/slash-menu';

/**
 * What a `/` can run, over the composer: the built-in commands Oppenheimer
 * runs, then the bot's skills, each its command in mono and what it does,
 * the keyboard's place highlighted across both. A click picks one; the
 * pointer press is kept from the field, so the caret stays where it was.
 */
export function BotSlashMenu({
  builtIns,
  skills,
  highlighted,
  onPick,
}: {
  builtIns: readonly SlashCommand[];
  skills: readonly SlashCommand[];
  highlighted: number;
  onPick: (command: SlashCommand) => void;
}) {
  const { t } = useTranslation();
  const item = (command: SlashCommand, index: number, icon: ReactNode) => (
    <ComposerMenuItem
      key={command.id}
      icon={icon}
      mono
      description={command.description}
      highlighted={index === highlighted}
      aria-label={t('bots.chat.slash.pick', { name: command.name })}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(command)}
    >
      {command.command}
    </ComposerMenuItem>
  );
  return (
    <ComposerMenu
      aria-label={t('bots.chat.slash.menu')}
      className="absolute inset-x-0 bottom-full z-10 mb-2"
    >
      {builtIns.length > 0 ? (
        <ComposerMenuGroup label={t('bots.chat.slash.builtInLabel')}>
          {builtIns.map((command, index) => item(command, index, <Target />))}
        </ComposerMenuGroup>
      ) : null}
      {skills.length > 0 ? (
        <ComposerMenuGroup label={t('bots.chat.slash.label')}>
          {skills.map((command, index) => item(command, builtIns.length + index, <SquareSlash />))}
        </ComposerMenuGroup>
      ) : null}
    </ComposerMenu>
  );
}
