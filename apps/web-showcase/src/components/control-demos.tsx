'use client';

import * as React from 'react';

import { Avatar, AvatarFallback } from '@oppenheimer/design-system-web/avatar';
import { Field, FieldDescription, FieldLabel } from '@oppenheimer/design-system-web/field';
import { NumberStepper } from '@oppenheimer/design-system-web/number-stepper';
import { PillGroup, PillGroupItem } from '@oppenheimer/design-system-web/pill-group';
import { Switch } from '@oppenheimer/design-system-web/switch';

/** A settings row as BotSettings draws one: label and hint, the control on the right. */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-operate">{label}</span>
        {hint ? <span className="text-sm text-fg-muted">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

/* ── Switch ──────────────────────────────────────────────────────────────── */

export function SwitchDemo() {
  const [learn, setLearn] = React.useState(true);
  const [messages, setMessages] = React.useState(false);
  const [compare, setCompare] = React.useState(true);
  return (
    <div className="flex w-full max-w-120 flex-col gap-4">
      <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-card">
        <Row label="Learn automatically" hint="Save facts it picks up in chat without asking">
          <Switch checked={learn} onCheckedChange={setLearn} aria-label="Learn automatically" />
        </Row>
        <Row label="Message other bots" hint="Ask another bot for help mid-task">
          <Switch checked={messages} onCheckedChange={setMessages} aria-label="Message other bots" />
        </Row>
        <Row label="Run shell commands" hint="Locked by the template">
          <Switch checked disabled title="The GitHub Bot template keeps this on" aria-label="Run shell commands" />
        </Row>
      </div>
      <label className="flex items-center gap-2.5 text-sm text-fg-muted">
        <Switch size="sm" checked={compare} onCheckedChange={setCompare} />
        Compare with previous period
      </label>
    </div>
  );
}

/* ── PillGroup ───────────────────────────────────────────────────────────── */

export function PillGroupDemo() {
  const [ttl, setTtl] = React.useState('1d');
  const [projects, setProjects] = React.useState(['acme-web', 'billing']);
  const [repos, setRepos] = React.useState(['acme/web']);
  const [ask, setAsk] = React.useState(['push', 'merge']);
  const [bots, setBots] = React.useState(['quota']);
  return (
    <div className="flex w-full max-w-140 flex-col gap-6">
      <Field>
        <FieldLabel>For how long</FieldLabel>
        <PillGroup value={ttl} onValueChange={setTtl} aria-label="For how long">
          <PillGroupItem value="1h">1 hour</PillGroupItem>
          <PillGroupItem value="1d">1 day</PillGroupItem>
          <PillGroupItem value="7d" disabled>
            7 days
          </PillGroupItem>
          <PillGroupItem value="never" disabled>
            Never
          </PillGroupItem>
        </PillGroup>
        <FieldDescription>Write access lasts a day at most.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Projects</FieldLabel>
        <PillGroup multiple value={projects} onValueChange={setProjects} aria-label="Projects">
          <PillGroupItem value="acme-web" count={12}>
            acme-web
          </PillGroupItem>
          <PillGroupItem value="billing" count={4}>
            billing
          </PillGroupItem>
          <PillGroupItem value="infra" count={7}>
            infra
          </PillGroupItem>
        </PillGroup>
      </Field>
      <Field>
        <FieldLabel>Repositories</FieldLabel>
        <PillGroup multiple value={repos} onValueChange={setRepos} aria-label="Repositories">
          <PillGroupItem mono value="acme/web">
            acme/web
          </PillGroupItem>
          <PillGroupItem mono value="acme/api">
            acme/api
          </PillGroupItem>
          <PillGroupItem mono value="acme/infra">
            acme/infra
          </PillGroupItem>
        </PillGroup>
      </Field>
      <Field>
        <FieldLabel>Always ask before</FieldLabel>
        <PillGroup multiple value={ask} onValueChange={setAsk} aria-label="Always ask before">
          <PillGroupItem check value="push">
            Pushing
          </PillGroupItem>
          <PillGroupItem check value="merge">
            Merging
          </PillGroupItem>
          <PillGroupItem check value="deploy">
            Deploying
          </PillGroupItem>
        </PillGroup>
      </Field>
      <Field>
        <FieldLabel>Allowed bots</FieldLabel>
        <PillGroup multiple value={bots} onValueChange={setBots} aria-label="Allowed bots">
          {[
            ['quota', 'Quota Bot', 'QB'],
            ['research', 'Research Bot', 'RB'],
          ].map(([id, name, initials]) => (
            <PillGroupItem
              key={id}
              value={id}
              leading={
                <Avatar size={18}>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              }
            >
              {name}
            </PillGroupItem>
          ))}
        </PillGroup>
      </Field>
    </div>
  );
}

/* ── NumberStepper ───────────────────────────────────────────────────────── */

export function NumberStepperDemo() {
  const [parallel, setParallel] = React.useState(3);
  const [hops, setHops] = React.useState(1);
  return (
    <div className="w-full max-w-120 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-card">
      <Row label="Parallel sessions" hint="Most it runs at the same time">
        <NumberStepper value={parallel} onValueChange={setParallel} min={1} max={8} aria-label="Parallel sessions" />
      </Row>
      <Row label="Hop limit" hint="How many bots a request may pass through">
        <NumberStepper
          value={hops}
          onValueChange={setHops}
          min={1}
          max={6}
          aria-label="Hop limit"
          labels={{ decrement: 'Fewer hops', increment: 'More hops' }}
        />
      </Row>
    </div>
  );
}
