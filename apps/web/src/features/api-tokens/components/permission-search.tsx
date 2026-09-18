import { SearchInput } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The permission catalog's search field, and the only thing a keystroke
 * re-renders.
 *
 * It is its own component for the reason `DataTableSearch` is: the draft has to
 * live below whatever maps the groups, or a keystroke re-renders the list
 * anyway. Holding `useSearchDraft` in `PermissionCatalog` was not enough —
 * measured, four characters cost 132 toggle renders, because the component that
 * owned the draft was also the one filtering. The budget in
 * `permission-picker-render.spec.tsx` is what says so.
 *
 * The policy — draft here, commit once per burst — is the kit's `useSearchDraft`
 * rather than a second debounce beside it. No `value`: nothing feeds a settled
 * query back down, so there is no echo to ignore.
 */
export function PermissionSearch({
  onChange,
  disabled,
}: {
  /** Receives the settled query, once per burst of typing. */
  onChange: (query: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { draft, type } = useSearchDraft({ onChange });
  const label = t('settings.api.searchPermissions');

  return (
    <SearchInput
      value={draft}
      onChange={(event) => type(event.target.value)}
      placeholder={label}
      aria-label={label}
      hint={null}
      containerClassName="w-full"
      disabled={disabled}
    />
  );
}
