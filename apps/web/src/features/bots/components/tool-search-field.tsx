import { Input } from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import { useSearchDraft } from '@oppenheimer/frontend-web';

/**
 * The search over a bot's tools. It owns the half-typed word and hands the
 * list the settled one, once per burst of typing, so a keystroke renders this
 * field and not the rows. Escape clears it.
 */
export function ToolSearchField({
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
      className="w-60 max-w-full"
      leading={<Search aria-hidden />}
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
