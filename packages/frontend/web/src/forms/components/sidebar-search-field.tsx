import { SidebarSearch } from '@oppenheimer/design-system-web';
import { useSearchDraft } from '../hooks/use-search-draft';

/**
 * A sidebar's search box: the design system's `SidebarSearch` on the search
 * policy (`useSearchDraft`). It owns the half-typed word and hands the list
 * the settled one, once per burst of typing, so a keystroke renders this box
 * and not the rows under it. Escape clears it, the same way.
 *
 * The strings are the caller's, because the kit knows no list's copy.
 */
export function SidebarSearchField({
  onChange,
  label,
  clearLabel,
}: {
  /** The settled search, once per burst of typing. */
  onChange: (query: string) => void;
  /** The placeholder and the accessible name. */
  label: string;
  clearLabel: string;
}) {
  const { draft, type } = useSearchDraft({ onChange });

  return (
    <SidebarSearch
      value={draft}
      onValueChange={type}
      onKeyDown={(event) => {
        if (event.key === 'Escape') type('');
      }}
      placeholder={label}
      aria-label={label}
      clearLabel={clearLabel}
    />
  );
}
