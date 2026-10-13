import { Avatar, Input } from '@oppenheimer/design-system-web';
import { MailIcon } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { initialsOf, isEmail } from '../lib/share-session';
import { SharePersonChip } from './share-person-chip';

/**
 * Who a session is shared with (`ShareSession.dc.html`): a field for a name
 * or an email, the suggestions under it while it has focus, and a chip per
 * person added. Workspaces are personal for now, so there is no member to
 * suggest: a whole email offers "Invite …", anything else says to type one.
 * Enter takes the suggestion, Backspace in an empty field takes the last
 * chip back, Escape leaves the field. The half-typed word is this field's.
 */
export function SharePeopleInput({
  value,
  exclude = [],
  onChange,
  invalid,
  disabled,
}: {
  value: string[];
  /** People already on the share, never offered again. */
  exclude?: readonly string[];
  onChange: (people: string[]) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const typed = query.trim().toLowerCase();
  const suggestion =
    isEmail(typed) && !value.includes(typed) && !exclude.includes(typed) ? typed : null;

  function add(email: string) {
    onChange([...value, email]);
    setQuery('');
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          leading={<MailIcon className="size-3.75" />}
          autoFocus
          aria-label={t('sessions.share.peopleLabel')}
          aria-invalid={invalid || undefined}
          placeholder={t('sessions.share.peoplePlaceholder')}
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (suggestion) add(suggestion);
            } else if (event.key === 'Backspace' && !query && value.length) {
              onChange(value.slice(0, -1));
            } else if (event.key === 'Escape' && focused) {
              event.stopPropagation();
              event.currentTarget.blur();
            }
          }}
        />
        {focused ? (
          <div
            role="listbox"
            aria-label={t('sessions.share.peopleLabel')}
            className="absolute inset-x-0 top-full z-10 mt-1 rounded-md bg-popover p-1 shadow-popover"
          >
            {suggestion ? (
              <button
                type="button"
                role="option"
                aria-selected
                // Held on mouse down, so picking does not blur the field first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(suggestion)}
                className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.75 text-left text-sm text-fg outline-none hover:bg-hover-surface"
              >
                <Avatar size="sm">{initialsOf(suggestion)}</Avatar>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">
                    {t('sessions.share.invite', { email: suggestion })}
                  </span>
                  <span className="truncate text-xs text-fg-muted">
                    {t('sessions.share.inviteHint')}
                  </span>
                </span>
              </button>
            ) : (
              <p className="m-0 px-2.5 py-2 text-sm text-fg-muted">
                {t('sessions.share.inviteEmpty')}
              </p>
            )}
          </div>
        ) : null}
      </div>
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((email) => (
            <SharePersonChip
              key={email}
              email={email}
              onRemove={() => onChange(value.filter((person) => person !== email))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
