'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { MailIcon, XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { inputVariants } from './input';

type Person = {
  id: string;
  name: string;
  email: string;
  initials: string;
  image?: string;
  /** Not a member of the workspace: they sign in to open what they were given. */
  external?: boolean;
};

type PeoplePickerLabels = {
  placeholder: string;
  /** The listbox's line when the query matches nobody and is not yet an email. */
  empty: string;
  /** The row's title for a typed address outside the workspace. */
  invite: (email: string) => string;
  /** The line under that row. */
  inviteDescription: string;
  /** The quiet note on a chip for someone outside the workspace. */
  outside: string;
  remove: (name: string) => string;
};

const DEFAULT_LABELS: PeoplePickerLabels = {
  placeholder: 'Name or email',
  empty: 'Type a full email address to invite someone outside the workspace.',
  invite: (email) => `Invite ${email}`,
  inviteDescription: 'Outside this workspace · they sign in to open it',
  outside: 'outside workspace',
  remove: (name) => `Remove ${name}`,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function initialsOf(email: string) {
  return email.slice(0, 2).toUpperCase();
}

/**
 * PeoplePicker — who a thing is shared with, picked by name or email (Share's
 * Specific people). A 34px field with the mail glyph; typing opens a listbox
 * under it of workspace members not yet picked, each a 22px avatar over the
 * name and the email. A full address nobody in the workspace has becomes one
 * "Invite …" row, marked `external`. The picked people sit under the field as
 * `PersonChip`s, wrapping at 6px.
 *
 * Enter picks the first match; Backspace in an empty field drops the last
 * chip; Esc closes the list. Matching runs over the `people` it is given:
 * when the roster is a page of an endpoint, pass `onQueryChange` and hand back
 * what the server found, the way `ChipSelect` does.
 *
 * ```tsx
 * <PeoplePicker people={members} value={picked} onValueChange={setPicked} />
 * ```
 */
function PeoplePicker({
  people,
  value,
  onValueChange,
  onQueryChange,
  allowInvite = true,
  labels,
  className,
}: {
  people: Person[];
  value: Person[];
  onValueChange: (value: Person[]) => void;
  /** Present: the caller searches; the picker shows `people` as given. */
  onQueryChange?: (query: string) => void;
  /** A typed address outside the workspace may be invited. */
  allowInvite?: boolean;
  labels?: Partial<PeoplePickerLabels>;
  className?: string;
}) {
  const label = { ...DEFAULT_LABELS, ...labels };
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const q = query.trim().toLowerCase();
  const pickedIds = new Set(value.map((p) => p.id));

  const matches = people.filter(
    (p) =>
      !pickedIds.has(p.id) &&
      (onQueryChange !== undefined ||
        (q !== '' && (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)))),
  );
  const known = people.some((p) => p.email.toLowerCase() === q) || pickedIds.has(q);
  const invite: Person | null =
    allowInvite && EMAIL.test(q) && !known
      ? { id: q, name: q, email: q, initials: initialsOf(q), external: true }
      : null;
  const items = invite ? [...matches, invite] : matches;

  function add(next: Person[]) {
    onValueChange(next);
    setQuery('');
    onQueryChange?.('');
  }

  return (
    <div data-slot="people-picker" className={cn('flex flex-col gap-2.5', className)}>
      <ComboboxPrimitive.Root
        multiple
        items={items}
        filter={null}
        value={value}
        onValueChange={(next) => add(next as Person[])}
        inputValue={query}
        onInputValueChange={(next) => {
          setQuery(next);
          onQueryChange?.(next);
        }}
        itemToStringLabel={(p: Person) => p.name}
        isItemEqualToValue={(a: Person, b: Person) => a.id === b.id}
        autoHighlight
        // Nothing to list until something is typed.
        open={open && query.trim() !== ''}
        onOpenChange={setOpen}
      >
        <ComboboxPrimitive.InputGroup className={cn(inputVariants({ size: 'md' }), 'cursor-text')}>
          <span className="flex shrink-0 text-fg-subtle">
            <MailIcon className="size-[15px]" />
          </span>
          <ComboboxPrimitive.Input
            placeholder={label.placeholder}
            onKeyDown={(event) => {
              if (event.key === 'Backspace' && query === '' && value.length > 0) {
                onValueChange(value.slice(0, -1));
              }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-inherit outline-none placeholder:text-field-placeholder"
          />
        </ComboboxPrimitive.InputGroup>
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner sideOffset={6} align="start" className="z-50 outline-none">
            <ComboboxPrimitive.Popup
              data-slot="people-picker-popup"
              className="flex max-h-62 w-(--anchor-width) flex-col overflow-y-auto rounded-md bg-popover p-1 text-fg shadow-popover outline-none transition-[opacity,transform] duration-fast ease-out data-ending-style:opacity-0 data-starting-style:-translate-y-1 data-starting-style:opacity-0 [scrollbar-width:thin]"
            >
              <ComboboxPrimitive.Empty className="px-3 py-3.5 text-center text-[12.5px] text-fg-muted empty:hidden">
                {label.empty}
              </ComboboxPrimitive.Empty>
              <ComboboxPrimitive.List>
                {(person: Person) => {
                  const inviting = invite !== null && person.id === invite.id;
                  return (
                  <ComboboxPrimitive.Item
                    key={person.id}
                    value={person}
                    className="flex cursor-default items-center gap-2.5 rounded-sm px-2.5 py-1.75 text-[13px] outline-none select-none data-highlighted:bg-hover-surface"
                  >
                    <PersonAvatar person={person} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{inviting ? label.invite(person.email) : person.name}</span>
                      <span className="truncate text-[11.5px] text-fg-muted">
                        {inviting ? label.inviteDescription : person.email}
                      </span>
                    </span>
                  </ComboboxPrimitive.Item>
                  );
                }}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
      </ComboboxPrimitive.Root>
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((person) => (
            <PersonChip
              key={person.id}
              person={person}
              outsideLabel={label.outside}
              removeLabel={label.remove(person.name)}
              onRemove={() => onValueChange(value.filter((p) => p.id !== person.id))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PersonAvatar({ person, size }: { person: Person; size: 'sm' | number }) {
  return (
    <Avatar size={size} className="flex-none">
      {person.image ? <AvatarImage src={person.image} alt="" /> : null}
      <AvatarFallback>{person.initials}</AvatarFallback>
    </Avatar>
  );
}

/**
 * PersonChip — one picked person: a 28px hairline pill with a 20px avatar,
 * the name, "outside workspace" in the subtle ink when they are not a member,
 * and a remove button. Also where a picked person reads outside a picker.
 */
function PersonChip({
  person,
  onRemove,
  outsideLabel = DEFAULT_LABELS.outside,
  removeLabel,
  className,
}: {
  person: Person;
  onRemove?: () => void;
  outsideLabel?: string;
  removeLabel?: string;
  className?: string;
}) {
  return (
    <span
      data-slot="person-chip"
      className={cn(
        'inline-flex h-7 max-w-full items-center gap-1.75 rounded-pill border border-border pl-1 text-sm font-medium text-fg',
        onRemove ? 'pr-1' : 'pr-2.5',
        className,
      )}
    >
      <PersonAvatar person={person} size={20} />
      <span className="truncate">{person.name}</span>
      {person.external ? <span className="shrink-0 text-[11.5px] font-normal text-fg-subtle">{outsideLabel}</span> : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={removeLabel ?? DEFAULT_LABELS.remove(person.name)}
          onClick={onRemove}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-pill text-fg-subtle outline-none transition-colors duration-fast hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

export { PeoplePicker, PersonChip };
export type { PeoplePickerLabels, Person };
