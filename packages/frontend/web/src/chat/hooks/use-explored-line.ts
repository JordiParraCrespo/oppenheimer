import { useTranslation } from 'react-i18next';
import { type ExploredLinePart, exploredLine } from '../lib/explored-line';

/** The words after an Explored heading, in the reader's language, for either chat's `detail`. */
export function useExploredLine(): (parts: readonly ExploredLinePart[]) => string {
  const { t } = useTranslation();
  return (parts) =>
    exploredLine(parts, {
      verb: {
        read: t('common.chat.explored.read'),
        search: t('common.chat.explored.search'),
        list: t('common.chat.explored.list'),
      },
      more: (count) => t('common.chat.explored.more', { count }),
    });
}
