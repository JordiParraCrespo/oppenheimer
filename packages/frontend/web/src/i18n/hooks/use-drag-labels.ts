import type { DragLabels } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/** What a screen reader hears while something is dragged on the drag layer, in the reader's language. */
export function useDragLabels(): DragLabels {
  const { t } = useTranslation();
  return {
    instructions: t('common.drag.instructions'),
    pickedUp: (name) => t('common.drag.pickedUp', { name }),
    over: (name, target) =>
      target ? t('common.drag.over', { name, target }) : t('common.drag.nowhere', { name }),
    dropped: (name, target) =>
      target
        ? t('common.drag.dropped', { name, target })
        : t('common.drag.droppedNowhere', { name }),
    cancelled: (name) => t('common.drag.cancelled', { name }),
  };
}
