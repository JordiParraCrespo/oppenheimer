import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import type { BotMemoryScope, BotMemoryTier } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A fact's ellipsis: where it is kept. One item moves it between in mind and
 * looked up, the other between this bot and all the person's bots.
 */
export function FactKeptMenu({
  fact,
  tier,
  scope,
  disabled,
  onChange,
}: {
  fact: string;
  tier: BotMemoryTier;
  scope: BotMemoryScope;
  disabled: boolean;
  onChange: (change: { tier?: BotMemoryTier; scope?: BotMemoryScope }) => void;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <IconButton
            aria-label={t('bots.settings.memory.keptActions', { fact })}
            variant="quiet"
            size="sm"
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-55">
        <DropdownMenuItem
          onClick={() => onChange({ tier: tier === 'profile' ? 'log' : 'profile' })}
        >
          {tier === 'profile'
            ? t('bots.settings.memory.toLog')
            : t('bots.settings.memory.toProfile')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange({ scope: scope === 'bot' ? 'person' : 'bot' })}>
          {scope === 'bot' ? t('bots.settings.memory.toPerson') : t('bots.settings.memory.toBot')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
