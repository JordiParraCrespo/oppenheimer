import {
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useNewBot } from '@/features/bots/hooks/use-create-bot';

/**
 * New bot, the plus in the Employees sidebar's brand row: a blank bot, then
 * its chat. A refusal opens under the plus, with Try again, since the row has
 * no room to say it in.
 */
export function NewBotButton() {
  const { t } = useTranslation();
  const newBot = useNewBot();

  return (
    <Popover open={Boolean(newBot.error)} onOpenChange={(open) => !open && newBot.reset()}>
      <PopoverTrigger
        render={
          <IconButton
            variant="quiet"
            size="sm"
            aria-label={t('bots.sidebar.new')}
            title={t('bots.sidebar.new')}
            disabled={newBot.pending}
            onClick={newBot.create}
          />
        }
      >
        <Plus />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-75">
        <ErrorAlert
          error={newBot.error}
          fallback={t('bots.sidebar.createFailed')}
          onDismiss={newBot.reset}
        />
      </PopoverContent>
    </Popover>
  );
}
