import {
  BotAvatar,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useBots } from '@oppenheimer/frontend-consumer/react';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SECTION_NAMES } from '@/features/bots/lib/section-names';

/**
 * The plus on a section's Bots heading (`28-bots-in-sections.md`, slice D):
 * New bot, then every bot with a check for whether this section lists it, then
 * the way to Employees, where bots are grouped, ordered and deleted. A check
 * flips the bot's placement at once and the menu stays open for the next.
 * The heading owns the open state (the empty line opens it too) and the two
 * writes, so their failures show under the heading once the menu is closed.
 * `saving` is the placement in flight: the checks hold still and show it.
 */
export function SectionBotsMenu({
  section,
  open,
  onOpenChange,
  creating,
  onCreate,
  saving,
  onPlace,
}: {
  section: BotSection;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creating: boolean;
  onCreate: () => void;
  saving: { id: string; sections: readonly BotSection[] } | undefined;
  onPlace: (bot: BotEntity, shown: boolean) => void;
}) {
  const { t } = useTranslation();
  const bots = useBots();
  const where = t(SECTION_NAMES[section]);

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <IconButton
            variant="quiet"
            size="xs"
            aria-label={t('bots.section.manage', { section: where })}
            title={t('bots.section.manage', { section: where })}
          />
        }
      >
        <Plus />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={creating} onClick={onCreate}>
          {creating ? t('bots.sidebar.creating') : t('bots.sidebar.new')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('bots.section.showHere', { section: where })}</DropdownMenuLabel>
          {bots.isPending ? (
            <DropdownMenuItem disabled>{t('common.loading')}</DropdownMenuItem>
          ) : bots.isError ? (
            <DropdownMenuItem disabled>{t('bots.sidebar.loadFailed')}</DropdownMenuItem>
          ) : bots.data.length === 0 ? (
            <DropdownMenuItem disabled>{t('bots.section.noBots')}</DropdownMenuItem>
          ) : (
            bots.data.map((bot) => (
              <DropdownMenuCheckboxItem
                key={bot.id}
                disabled={saving !== undefined}
                checked={(saving?.id === bot.id ? saving.sections : bot.sections).includes(section)}
                onCheckedChange={(shown) => onPlace(bot, shown)}
              >
                <BotAvatar option={bot} size={18} color={bot.avatarColor} />
                <span className="truncate">{bot.name}</span>
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/bots" />}>
          {t('bots.section.manageAll', { employees: t('nav.employees') })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
