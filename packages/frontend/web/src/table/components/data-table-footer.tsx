import { IconButton } from '@oppenheimer/design-system-web';
import { ChevronLeft, ChevronRight } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import type { DataTablePagination } from '../lib/data-table-types';

/** The range, the page count and the two arrows. Nothing above it re-renders it. */
export function DataTableFooter({ pagination }: { pagination: DataTablePagination }) {
  const { t } = useTranslation();
  const { page, pageSize, total, totalPages, onPageChange } = pagination;

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center gap-3 px-4 py-3 whitespace-nowrap">
      <span className="mr-auto text-sm text-ink-400">
        {t('table.range', { first, last, total })}
      </span>
      <span className="text-sm text-ink-600">
        {t('table.page', { page, totalPages: Math.max(1, totalPages) })}
      </span>
      <IconButton
        size="default"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t('table.previousPage')}
      >
        <ChevronLeft />
      </IconButton>
      <IconButton
        size="default"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={t('table.nextPage')}
      >
        <ChevronRight />
      </IconButton>
    </div>
  );
}
