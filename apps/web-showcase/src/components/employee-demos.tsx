'use client';

import * as React from 'react';

import { AvatarPicker, BotAvatar, type AvatarOption } from '@oppenheimer/design-system-web/avatar-picker';
import { Badge } from '@oppenheimer/design-system-web/badge';
import { BotItem, BotList } from '@oppenheimer/design-system-web/bot-item';
import { Button } from '@oppenheimer/design-system-web/button';
import { IconButton } from '@oppenheimer/design-system-web/icon-button';
import { ChevronLeftIcon, ClockIcon, EllipsisIcon, PencilIcon, WebhookIcon, XIcon } from '@oppenheimer/design-system-web/icons';
import { Input } from '@oppenheimer/design-system-web/input';
import { RoutineCard } from '@oppenheimer/design-system-web/routine-card';
import { SegmentedControl, SegmentedControlItem } from '@oppenheimer/design-system-web/segmented-control';
import {
  SettingsAddRow,
  SettingsGroup,
  SettingsListRow,
} from '@oppenheimer/design-system-web/settings-group';
import { SettingsTopBar } from '@oppenheimer/design-system-web/settings-shell';
import { Switch } from '@oppenheimer/design-system-web/switch';
import { Textarea } from '@oppenheimer/design-system-web/textarea';

import { GroupHead, Spec } from './page-shell';

/* ── BotItem ─────────────────────────────────────────────────────────────── */

export function BotItemsDemo() {
  const [active, setActive] = React.useState('release');
  const bots = [
    { id: 'release', name: 'Release Bot', initials: 'RB', age: '2m', preview: 'The stop path now reaches the tool layer.', live: true },
    { id: 'quota', name: 'Quota Bot', initials: 'QB', age: '1d', preview: 'You: Added a banner to the workspace page' },
    { id: 'research', name: 'Research Bot', initials: 'RS', age: '4d', preview: 'Only one of the three propagates the signal.' },
    { id: 'new', name: 'New Bot', initials: 'NB', age: '3h', preview: 'What would you most like help with?', unread: true },
  ];
  return (
    <div className="w-72 rounded-lg bg-sidebar p-1.5">
      <BotList>
        {bots.map((bot) => (
          <BotItem
            key={bot.id}
            {...bot}
            active={bot.id === active}
            onClick={() => setActive(bot.id)}
          />
        ))}
      </BotList>
    </div>
  );
}

/* ── AvatarPicker ────────────────────────────────────────────────────────── */

const PHOTOS: AvatarOption[] = Array.from({ length: 9 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Photo ${i + 1}`,
  initials: ['AL', 'BO', 'CU', 'DI', 'EM', 'FE', 'GR', 'HO', 'IR'][i] as string,
  caption: ['Ada', 'Bohr', 'Curie', 'Dirac', 'Emmy', 'Fermi', 'Grace', 'Hopper', 'Irène'][i],
}));

export function AvatarPickerDemo() {
  const [photo, setPhoto] = React.useState('p7');
  const shuffle = () => setPhoto(PHOTOS[Math.floor(Math.random() * PHOTOS.length)]?.id ?? 'p1');
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="w-75 rounded-md border border-border-subtle bg-card p-4 shadow-popover">
        <AvatarPicker
          options={PHOTOS}
          value={photo}
          onValueChange={setPhoto}
          name="Release Bot"
          note="Shown in the sidebar and the chat"
          onShuffle={shuffle}
        />
      </div>
      <div className="w-full max-w-180 rounded-lg bg-canvas-recessed p-4">
        <div className="rounded-lg bg-card px-5 py-4">
        <AvatarPicker layout="wide" options={PHOTOS.map(({ caption: _, ...p }) => p)} value={photo} onValueChange={setPhoto} />
        </div>
      </div>
    </div>
  );
}

/* ── RoutineCard ─────────────────────────────────────────────────────────── */

export function RoutineCardsDemo() {
  const [on, setOn] = React.useState({ digest: true, triage: false });
  const [kind, setKind] = React.useState('schedule');
  return (
    <div className="flex w-full max-w-180 flex-col gap-3 rounded-lg bg-canvas-recessed p-4">
      <RoutineCard
        name="Morning release digest"
        icon={<ClockIcon />}
        trigger="Schedule · Weekdays at 09:00"
        prompt="Summarise what merged since yesterday, what is waiting on review, and any failing checks on main."
        last="Today 09:00"
        next="Tomorrow 09:00"
        active={on.digest}
        onActiveChange={(v) => setOn((s) => ({ ...s, digest: v }))}
        onEdit={() => {}}
        onDelete={() => {}}
      />
      <RoutineCard
        name="Triage new issues"
        icon={<WebhookIcon />}
        trigger="Webhook · issue opened in acme/web"
        prompt="Label the issue, find the owning team, and ask for a reproduction when it has none."
        last="2d ago"
        next="—"
        active={on.triage}
        onActiveChange={(v) => setOn((s) => ({ ...s, triage: v }))}
        onEdit={() => {}}
        onDelete={() => {}}
      />
      <RoutineCard name="Weekly dependency sweep" trigger="" active>
        <div className="flex flex-col gap-3">
          <Input defaultValue="Weekly dependency sweep" aria-label="Routine name" />
          <SegmentedControl value={kind} onValueChange={setKind} size="md" aria-label="Trigger">
            <SegmentedControlItem value="schedule">Schedule</SegmentedControlItem>
            <SegmentedControlItem value="webhook">Webhook</SegmentedControlItem>
            <SegmentedControlItem value="event">Event</SegmentedControlItem>
          </SegmentedControl>
          <Input defaultValue="Mondays at 08:00" aria-label="When" />
          <Textarea rows={3} defaultValue="Open one pull request bumping every patch-level dependency." aria-label="Prompt" />
          <div className="flex gap-2">
            <Button size="sm">Save routine</Button>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      </RoutineCard>
    </div>
  );
}

/* ── SettingsListRow · SettingsAddRow ────────────────────────────────────── */

export function SettingsListDemo() {
  const [facts, setFacts] = React.useState([
    { id: 1, text: 'Prefers squash merges on acme/web', kind: 'Preference', src: 'Learned in chat · Oct 2' },
    { id: 2, text: 'Release branches are cut on Thursdays', kind: 'Process', src: 'Added by you · Sep 28' },
  ]);
  const [draft, setDraft] = React.useState('');
  const [mcp, setMcp] = React.useState({ linear: true, sentry: false });
  return (
    <div className="flex w-full max-w-164 flex-col gap-6">
      <SettingsGroup>
        <SettingsListRow lead="You" meta="INSTRUCTIONS.md · Just now" actions="Current" align="center">
          Ask before force-pushing any branch
        </SettingsListRow>
        <SettingsListRow
          lead="Release Bot"
          meta="SOUL.md · Oct 9"
          align="center"
          actions={
            <Button variant="secondary" size="sm">
              Revert
            </Button>
          }
        >
          Tightened the tone of release notes
        </SettingsListRow>
      </SettingsGroup>
      <SettingsGroup>
        {facts.map((f) => (
          <SettingsListRow
            key={f.id}
            kind={f.kind}
            meta={f.src}
            actions={
              <>
                <IconButton size="sm" aria-label="Edit fact">
                  <PencilIcon />
                </IconButton>
                <IconButton size="sm" aria-label="Delete fact" onClick={() => setFacts((xs) => xs.filter((x) => x.id !== f.id))}>
                  <XIcon />
                </IconButton>
              </>
            }
          >
            {f.text}
          </SettingsListRow>
        ))}
        <SettingsListRow muted kind="Shared" meta="From Quota Bot">
          The billing service owns usage limits
        </SettingsListRow>
        <SettingsAddRow
          value={draft}
          onValueChange={setDraft}
          onAdd={() => {
            setFacts((xs) => [...xs, { id: Date.now(), text: draft, kind: 'Fact', src: 'Added by you · Just now' }]);
            setDraft('');
          }}
          placeholder="Add a fact, e.g. Prefers squash merges"
          aria-label="New fact"
        />
      </SettingsGroup>
      <SettingsGroup>
        <SettingsListRow
          align="center"
          meta={<span className="font-mono">https://mcp.linear.app/sse</span>}
          actions={<Switch checked={mcp.linear} onCheckedChange={(v) => setMcp((s) => ({ ...s, linear: v }))} aria-label="Linear" />}
        >
          Linear
        </SettingsListRow>
        <SettingsListRow
          align="center"
          meta={<span className="font-mono">https://mcp.sentry.dev/sse</span>}
          actions={<Switch checked={mcp.sentry} onCheckedChange={(v) => setMcp((s) => ({ ...s, sentry: v }))} aria-label="Sentry" />}
        >
          Sentry
        </SettingsListRow>
        <SettingsAddRow mono value="" onValueChange={() => {}} onAdd={() => {}} placeholder="Connector URL, e.g. https://mcp.linear.app/sse" aria-label="Connector URL" />
      </SettingsGroup>
    </div>
  );
}

/* ── SettingsTopBar ──────────────────────────────────────────────────────── */

export function SettingsTopBarDemo() {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border-subtle bg-canvas">
      <SettingsTopBar
        back={
          <IconButton size="sm" aria-label="Back to employees">
            <ChevronLeftIcon />
          </IconButton>
        }
        avatar={<BotAvatar option={{ initials: 'RB' }} size={30} />}
        title="Release Bot"
        badge={<Badge variant="soft">Built-in</Badge>}
        saved="Saved"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Open chat
            </Button>
            <IconButton size="sm" aria-label="Bot actions">
              <EllipsisIcon />
            </IconButton>
          </>
        }
      />
      <div className="h-16" />
    </div>
  );
}

/** The Employees group: the bot row, its photo, its routines and its settings rows. */
export function EmployeesSection() {
  return (
    <>
      <GroupHead>Employees</GroupHead>

      <Spec
        id="botitem"
        title="BotItem"
        meta="bot-item.tsx"
        desc="An employee in the sidebar, read like a conversation: a 36px photo (initials in ink until it loads) with a green dot on its corner while the bot works, the name and the age in mono, then the last message in muted ink. Unread sets the name at 600, the preview in full ink and a blue dot at the end; the open chat rests on the selected wash. 14px radius, rows 2px apart in a BotList. SortableBotItem moves one to another group on the shell's drag layer."
        code={`<BotList><SortableBotItem id={bot.id} name="Release Bot" initials="RB" image={photo} preview={last} age="2m" live active /></BotList>`}
      >
        <BotItemsDemo />
      </Spec>

      <Spec
        id="avatarpicker"
        title="AvatarPicker"
        meta="avatar-picker.tsx"
        desc="A bot's photo picked from a set: the current one beside the bot's name, then a grid of round photos over optional captions, the picked one on the selected wash; arrow keys move through it. compact is the 300px popover off the chat header (four columns, 36px photos, Surprise me under the grid); wide is BotSettings' Profile (76px columns, 40px photos, a 72px preview). BotAvatar is the photo alone, initials in ink until the image loads."
        code={`<AvatarPicker options={photos} value={photo} onValueChange={setPhoto} name="Release Bot" onShuffle={shuffle} />`}
      >
        <AvatarPickerDemo />
      </Spec>

      <Spec
        id="routinecard"
        title="RoutineCard"
        meta="routine-card.tsx"
        desc="Something a bot does on its own, read in full on its settings: the name, the Switch (Pause / Resume) and the edit and delete buttons; the trigger as a glyph and a line; the prompt in muted ink; the last and next run in mono. A paused card fades to 60%. Editing, the caller's form replaces the read view inside the same card. The sidebar's workspace automations stay RoutineItem."
        code={`<RoutineCard name="Morning digest" icon={<ClockIcon />} trigger="Schedule · Weekdays at 09:00" prompt="…" last="Today 09:00" next="Tomorrow 09:00" active={on} onActiveChange={setOn} onEdit={edit} onDelete={remove} />`}
      >
        <RoutineCardsDemo />
      </Spec>

      <Spec
        id="settingslist"
        title="SettingsListRow · SettingsAddRow"
        meta="settings-group.tsx"
        desc="Records in a settings card rather than settings: a revision with who made it as a pill and Revert, a learned fact with its kind as an 18px tag and its source, a connector with its URL in mono and a Switch. A fact shared from another bot is muted. SettingsAddRow is the card's last row, a borderless field and Add, off until there is something to add; Enter adds too."
        code={`<SettingsGroup><SettingsListRow kind="Preference" meta="Learned in chat · Oct 2" actions={…}>Prefers squash merges</SettingsListRow><SettingsAddRow value={draft} onValueChange={setDraft} onAdd={add} aria-label="New fact" /></SettingsGroup>`}
      >
        <SettingsListDemo />
      </Spec>

      <Spec
        id="settingstopbar"
        title="SettingsTopBar"
        meta="settings-shell.tsx"
        desc="The bar over one thing's own settings, where Settings' nav would not say whose they are: back, the 30px photo and the name, a badge (Built-in), then a Saved flash after a change and the actions (Open chat, the ellipsis)."
        code={`<SettingsTopBar back={…} avatar={<BotAvatar option={bot} size={30} />} title="Release Bot" badge={<Badge variant="soft">Built-in</Badge>} saved={saved && 'Saved'} actions={…} />`}
      >
        <SettingsTopBarDemo />
      </Spec>
    </>
  );
}
