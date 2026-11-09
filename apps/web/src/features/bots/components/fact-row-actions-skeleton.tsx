import { Button, IconButton } from '@oppenheimer/design-system-web';
import { Ellipsis, X } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * A fact row's three controls before the facts answer, as `BotFactRow` draws
 * them with nothing to act on: Edit, where it is kept and forget, each off.
 * The row around them is hidden from assistive technology.
 */
export function FactRowActionsSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <Button variant="ghost" size="sm" disabled tabIndex={-1}>
        {t('bots.settings.memory.edit')}
      </Button>
      <IconButton variant="quiet" size="sm" disabled tabIndex={-1}>
        <Ellipsis />
      </IconButton>
      <IconButton variant="quiet" size="sm" disabled tabIndex={-1}>
        <X />
      </IconButton>
    </>
  );
}
