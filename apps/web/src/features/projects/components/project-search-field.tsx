import { Input } from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import { useSearchDraft } from '@oppenheimer/frontend-web';

/**
 * The search over Projects' cards. It owns the half-typed word and hands the
 * list the settled one, once per burst of typing, so a keystroke renders this
 * field and not the cards. Escape clears it. It stands beside the header's
 * New project button, so it takes the button's rung (`md`), not `sm`.
 */
export function ProjectSearchField({
  value,
  onChange,
  label,
}: {
  /** The settled search, as the address keeps it. */
  value: string;
  onChange: (query: string) => void;
  label: string;
}) {
  const { draft, type } = useSearchDraft({ value, onChange });

  return (
    <Input
      type="search"
      pill
      className="w-64 max-w-full"
      inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
      leading={<Search className="size-4" aria-hidden />}
      value={draft}
      onChange={(event) => type(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') type('');
      }}
      placeholder={label}
      aria-label={label}
    />
  );
}
