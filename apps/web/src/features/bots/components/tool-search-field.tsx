import { Input } from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import { useSearchDraft } from '@oppenheimer/frontend-web';

/**
 * The search over a bot's tools, and over the chats Add chats offers it. It
 * owns the half-typed word and hands the list the settled one, once per burst
 * of typing, so a keystroke renders this field and not the rows. Escape
 * clears it.
 */
export function ToolSearchField({
  value,
  onChange,
  label,
  className = 'w-60 max-w-full',
}: {
  /** The settled search, as the address keeps it. */
  value: string;
  onChange: (query: string) => void;
  label: string;
  /** Its width and place in the toolbar it stands in. */
  className?: string;
}) {
  const { draft, type } = useSearchDraft({ value, onChange });

  return (
    <Input
      type="search"
      size="sm"
      pill
      className={className}
      leading={<Search className="size-3.5" aria-hidden />}
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
