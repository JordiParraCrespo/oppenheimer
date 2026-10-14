'use client';

import * as React from 'react';

import { AccessList, AccessRow } from '@oppenheimer/design-system-web/access-list';
import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Field, FieldLabel } from '@oppenheimer/design-system-web/field';
import { PeoplePicker, PersonChip, type Person } from '@oppenheimer/design-system-web/people-picker';

import { GroupHead, Spec } from './page-shell';

const MEMBERS: Person[] = [
  { id: 'lea', name: 'Lea Brandt', email: 'lea@acme.dev', initials: 'LB' },
  { id: 'marco', name: 'Marco Ruiz', email: 'marco@acme.dev', initials: 'MR' },
  { id: 'ines', name: 'Inés Vidal', email: 'ines@acme.dev', initials: 'IV' },
  { id: 'tom', name: 'Tom Okafor', email: 'tom@acme.dev', initials: 'TO' },
];

/* ── PeoplePicker ────────────────────────────────────────────────────────── */

export function PeoplePickerDemo() {
  const [picked, setPicked] = React.useState<Person[]>([
    MEMBERS[0] as Person,
    { id: 'sam@contractor.io', name: 'sam@contractor.io', email: 'sam@contractor.io', initials: 'SA', external: true },
  ]);
  return (
    <div className="flex w-full max-w-130 flex-col gap-8">
      <Field>
        <FieldLabel>Share with</FieldLabel>
        <PeoplePicker people={MEMBERS} value={picked} onValueChange={setPicked} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        <PersonChip person={MEMBERS[1] as Person} />
        <PersonChip person={{ id: 'x', name: 'dana@studio.co', email: 'dana@studio.co', initials: 'DA', external: true }} />
      </div>
    </div>
  );
}

/* ── AccessList ──────────────────────────────────────────────────────────── */

function Initials({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <Avatar size="sm" variant={accent ? 'accent' : 'neutral'}>
      <AvatarFallback>{children}</AvatarFallback>
    </Avatar>
  );
}

export function AccessListDemo() {
  const [rows, setRows] = React.useState(['link', 'lea', 'sam']);
  const drop = (id: string) => setRows((r) => r.filter((x) => x !== id));
  return (
    <Field className="w-full max-w-140">
      <FieldLabel>Who has access</FieldLabel>
      <AccessList>
        <AccessRow avatar={<Initials accent>JP</Initials>} name="Jordi Parra" sub="You · jordi@acme.dev" role="Owner" />
        {rows.includes('link') ? (
          <AccessRow
            avatar={<Initials>··</Initials>}
            name="Anyone with the link"
            sub="Must sign in to open"
            role="Can view"
            ends="23h left"
            onRemove={() => drop('link')}
            removeLabel="Stop sharing the link"
          />
        ) : null}
        {rows.includes('lea') ? (
          <AccessRow
            avatar={<Initials>LB</Initials>}
            name="Lea Brandt"
            sub="lea@acme.dev"
            role="Can view"
            ends="23h left"
            onRemove={() => drop('lea')}
          />
        ) : null}
        {rows.includes('sam') ? (
          <AccessRow
            avatar={<Initials>SA</Initials>}
            name="sam@contractor.io"
            sub="sam@contractor.io · outside workspace"
            role="Can write"
            ends="58m left"
            onRemove={() => drop('sam')}
          />
        ) : null}
      </AccessList>
    </Field>
  );
}

/** The Share group: who a session is shared with, and who holds access. */
export function ShareSection() {
  return (
    <>
      <GroupHead>Share</GroupHead>

      <Spec
        id="peoplepicker"
        title="PeoplePicker · PersonChip"
        meta="people-picker.tsx"
        desc="Who a session is shared with, by name or email. Typing opens a list of members not yet picked; a full address nobody in the workspace has becomes one Invite row, marked outside the workspace. Picked people sit under the field as PersonChips. Enter picks the first match, Backspace in an empty field drops the last chip. A server-searched roster passes onQueryChange."
        code={`<PeoplePicker people={members} value={picked} onValueChange={setPicked} />`}
      >
        <PeoplePickerDemo />
      </Spec>

      <Spec
        id="accesslist"
        title="AccessList"
        meta="access-list.tsx"
        desc="Who can open a shared session, and until when. A hairline card, one row per holder: the avatar, the name over a subtle line, the role as a neutral Badge, the time left in mono in a 72px column so the ends line up. The owner cannot be removed and keeps the button's room; a link is a row of its own, so stopping it reads like removing a person."
        code={`<AccessList><AccessRow avatar={…} name="Lea Brandt" sub="lea@acme.dev" role="Can view" ends="23h left" onRemove={…} /></AccessList>`}
      >
        <AccessListDemo />
      </Spec>
    </>
  );
}
