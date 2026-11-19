import { ComposerMenu, ComposerMenuGroup, ComposerMenuItem } from '@oppenheimer/design-system-web';
import { SquareSlash, Terminal } from '@oppenheimer/design-system-web/icons';
import type { SlashCommand } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * What a `/` runs in the session's agent, over the chat composer: the
 * project's skills and commands, then Claude Code's own commands, each its
 * command in mono and what it does, the keyboard's place highlighted across
 * both. A click picks one; the pointer press is kept from the field, so the
 * caret stays where it was.
 */
export function SessionSlashMenu({
  project,
  builtIns,
  highlighted,
  onPick,
}: {
  project: readonly SlashCommand[];
  builtIns: readonly SlashCommand[];
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
      aria-label={t('sessions.chat.slash.pick', { name: command.name })}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onPick(command)}
    >
      {command.command}
    </ComposerMenuItem>
  );
  return (
    <ComposerMenu
      aria-label={t('sessions.chat.slash.menu')}
      className="absolute inset-x-0 bottom-full z-10 mb-2"
    >
      {project.length > 0 ? (
        <ComposerMenuGroup label={t('sessions.chat.slash.projectLabel')}>
          {project.map((command, index) => item(command, index, <SquareSlash />))}
        </ComposerMenuGroup>
      ) : null}
      {builtIns.length > 0 ? (
        <ComposerMenuGroup label={t('sessions.chat.slash.builtInLabel')}>
          {builtIns.map((command, index) => item(command, project.length + index, <Terminal />))}
        </ComposerMenuGroup>
      ) : null}
    </ComposerMenu>
  );
}
