import { Input } from '@oppenheimer/design-system-web';
import { Search } from '@oppenheimer/design-system-web/icons';
import { useSearchDraft } from '@oppenheimer/frontend-web';

/**
 * The search over a number's chats. It owns the half-typed words and hands
 * the list the settled ones, once per burst of typing, so a keystroke renders
 * this field and not the rows. Escape clears it.
 */
export function ChatSearchField({
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
      size="sm"
      pill
      className="w-64 max-w-full"
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
