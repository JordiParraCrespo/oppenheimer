import { ComposerMenu, ComposerMenuGroup, ComposerMenuItem } from '@oppenheimer/design-system-web';
import { SquareSlash } from '@oppenheimer/design-system-web/icons';
import type { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * The skills a `/` can run, over the composer: each its command in mono and
 * what it does, the keyboard's place highlighted. A click picks one; the
 * pointer press is kept from the field, so the caret stays where it was.
 */
export function BotSlashMenu({
  items,
  highlighted,
  onPick,
}: {
  items: readonly BotSkillEntity[];
  highlighted: number;
  onPick: (skill: BotSkillEntity) => void;
}) {
  const { t } = useTranslation();
  return (
    <ComposerMenu
      aria-label={t('bots.chat.slash.menu')}
      className="absolute inset-x-0 bottom-full z-10 mb-2"
    >
      <ComposerMenuGroup label={t('bots.chat.slash.label')}>
        {items.map((skill, index) => (
          <ComposerMenuItem
            key={skill.id}
            icon={<SquareSlash />}
            mono
            description={skill.description}
            highlighted={index === highlighted}
            aria-label={t('bots.chat.slash.pick', { name: skill.name })}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(skill)}
          >
            {skill.command}
          </ComposerMenuItem>
        ))}
      </ComposerMenuGroup>
    </ComposerMenu>
  );
}
