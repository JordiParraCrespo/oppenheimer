'use client';

import { Button } from '@oppenheimer/design-system-web/button';
import { Chip } from '@oppenheimer/design-system-web/chip';
import { ChipSelect, type ChipSelectOption } from '@oppenheimer/design-system-web/chip-select';
import { DatePicker } from '@oppenheimer/design-system-web/date-picker';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@oppenheimer/design-system-web/dialog';
import { PlayIcon } from '@oppenheimer/design-system-web/icons';
import { Kbd } from '@oppenheimer/design-system-web/kbd';
import { SessionPaneBack, SessionPaneHeader } from '@oppenheimer/design-system-web/session-pane-header';
import { dotVariants } from '@oppenheimer/design-system-web/status-dot';
import { TASK_STATUS_STATE, type TaskStatus } from '@oppenheimer/design-system-web/task-board';
import {
  Terminal,
  TerminalLine,
  TerminalPrompt,
  TerminalScrollback,
} from '@oppenheimer/design-system-web/terminal';
import * as React from 'react';

import { COLUMNS, TODAY } from './plan-fixtures';

/* ------------------------------------------------------------------ the dialogs */

const PROJECTS: ChipSelectOption[] = [
  { value: 'xrp-mobile', label: 'XRP Mobile' },
  { value: 'atlas', label: 'Atlas' },
  { value: 'client-sites', label: 'Client sites' },
];
const GOAL_OPTIONS: ChipSelectOption[] = [
  { value: 'none', label: 'No goal' },
  { value: 'atlas-beta', label: 'Atlas public beta' },
];
const HOST_OPTIONS: ChipSelectOption[] = [
  { value: 'mac-studio', label: 'jordis-mac-studio', description: 'local · 2 sessions running' },
  { value: 'optimus', label: 'optimus', description: '32 vCPU · eu-west · idle' },
];
const REPO_OPTIONS: ChipSelectOption[] = [
  { value: 'atlas', label: 'atlas', description: 'main', mono: true },
  { value: 'flama-ai', label: 'flama-ai', description: 'main', mono: true },
];

/**
 * The task dialog and Start session as the system draws them, in one state
 * each: the statuses and the agent's models are fixed, so they are chips;
 * projects, goals, hosts and repositories grow with the workspace, so they
 * are `ChipSelect`s that filter. What a pick does (an offline host, a
 * queued start) is the console's, not drawn here.
 */
export function PlanDialogsDemo() {
  const [taskOpen, setTaskOpen] = React.useState(false);
  const [startOpen, setStartOpen] = React.useState(false);
  const [status, setStatus] = React.useState<TaskStatus>('todo');
  const [project, setProject] = React.useState('atlas');
  const [goal, setGoal] = React.useState('atlas-beta');
  const [due, setDue] = React.useState<string | null>('2026-10-10');
  const [host, setHost] = React.useState('mac-studio');
  const [repo, setRepo] = React.useState('atlas');
  const [agent, setAgent] = React.useState('Claude Code');
  const [model, setModel] = React.useState('Sonnet 4.6');

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" onClick={() => setTaskOpen(true)}>
        Edit task
      </Button>
      <Button variant="secondary" onClick={() => setStartOpen(true)}>
        <PlayIcon />
        Start session
      </Button>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent size="form">
          <DialogBody>
            <div className="flex flex-col gap-5">
            <DialogTitle>Edit task</DialogTitle>
            <div className="flex flex-col gap-2 border-b border-border-subtle pb-4">
              <input
                aria-label="Title"
                defaultValue="Draft the beta waitlist email"
                className="border-0 bg-transparent p-0 text-h3 font-semibold text-fg outline-none"
              />
              <textarea
                aria-label="Notes"
                rows={3}
                placeholder="Notes"
                className="resize-none border-0 bg-transparent p-0 text-sm text-fg outline-none placeholder:text-fg-muted"
              />
            </div>
            <dl className="grid grid-cols-4 items-center gap-x-4 gap-y-3 text-sm">
              <dt className="col-span-1 text-fg-muted">Status</dt>
              <dd className="col-span-3 m-0 flex flex-wrap gap-1.5">
                {COLUMNS.map((c) => (
                  <Chip key={c.id} variant="solid" selected={status === c.id} onClick={() => setStatus(c.id)} icon={<span className={dotVariants({ state: TASK_STATUS_STATE[c.id] })} />}>
                    {c.label}
                  </Chip>
                ))}
              </dd>
              <dt className="col-span-1 text-fg-muted">Project</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={project} onValueChange={setProject} options={PROJECTS} aria-label="Project" searchPlaceholder="Search projects…" emptyText="No project matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Goal</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={goal} onValueChange={setGoal} options={GOAL_OPTIONS} aria-label="Goal" searchPlaceholder="Search goals…" emptyText="No goal matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Sessions</dt>
              <dd className="col-span-3 m-0 flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => setStartOpen(true)}>
                  <PlayIcon />
                  Start session
                </Button>
                <Button variant="ghost" size="sm">
                  Link existing
                </Button>
              </dd>
              <dt className="col-span-1 text-fg-muted">Due</dt>
              <dd className="col-span-3 m-0 flex items-center gap-3">
                <DatePicker value={due} onValueChange={setDue} today={TODAY} />
                <span className="text-xs text-fg-subtle">In 5 days</span>
              </dd>
            </dl>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="destructive-ghost" className="mr-auto">
              Delete task
            </Button>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setTaskOpen(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent size="form">
          <DialogBody>
            <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <DialogTitle>Start session</DialogTitle>
              <span className="text-sm text-fg-muted">For “Draft the beta waitlist email”</span>
            </div>
            <textarea
              aria-label="Prompt"
              rows={4}
              defaultValue="Draft the beta waitlist email"
              className="resize-none rounded-md border border-border bg-card px-3.5 py-3 font-mono text-sm text-fg outline-none focus:border-primary focus:ring-3 focus:ring-ring"
            />
            <dl className="grid grid-cols-4 items-center gap-x-4 gap-y-3 text-sm">
              <dt className="col-span-1 text-fg-muted">Repository</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={repo} onValueChange={setRepo} options={REPO_OPTIONS} aria-label="Repository" searchPlaceholder="Search repositories…" emptyText="No repository matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Host</dt>
              <dd className="col-span-3 m-0">
                <ChipSelect value={host} onValueChange={setHost} options={HOST_OPTIONS} aria-label="Host" searchPlaceholder="Search hosts…" emptyText="No host matches." />
              </dd>
              <dt className="col-span-1 text-fg-muted">Agent</dt>
              <dd className="col-span-3 m-0 flex flex-wrap gap-1.5">
                {['Claude Code', 'Codex', 'OpenCode'].map((a) => (
                  <Chip key={a} variant="solid" selected={agent === a} onClick={() => setAgent(a)}>
                    {a}
                  </Chip>
                ))}
              </dd>
              <dt className="col-span-1 text-fg-muted">Model</dt>
              <dd className="col-span-3 m-0 flex flex-col gap-1.5">
                <span className="flex flex-wrap gap-1.5">
                  {['Opus 4.6', 'Sonnet 4.6', 'Haiku 4.5'].map((m) => (
                    <Chip key={m} variant="solid" selected={model === m} onClick={() => setModel(m)}>
                      {m}
                    </Chip>
                  ))}
                </span>
                <span className="text-xs text-fg-muted">Most efficient for everyday tasks</span>
              </dd>
            </dl>
            </div>
          </DialogBody>
          <DialogFooter>
            <span className="mr-auto flex items-center gap-1 text-xs text-fg-subtle">
              <Kbd>⌘</Kbd>
              <Kbd>⏎</Kbd>
              to start
            </span>
            <Button variant="ghost" onClick={() => setStartOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setStartOpen(false)}>Start session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ the session pane */

/**
 * The bar over a session's terminal: opened from the console, then from a
 * task (the way back leads), in each run state.
 */
export function SessionPaneHeaderDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <SessionPaneHeader
          state="running"
          name="PR #121 porting to peersyst"
          stateLabel="Running"
          meta="claude-code · sonnet 4.6 · xrp-mobile"
        />
        <div className="h-28">
          <Terminal>
            <TerminalScrollback>
              <TerminalLine tone="dim">Working on it. Edited 3 files so far.</TerminalLine>
            </TerminalScrollback>
            <TerminalPrompt />
          </Terminal>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <SessionPaneHeader
          state="needs-input"
          name="biometric-unlock"
          stateLabel="Needs input"
          meta="claude-code · opus 4.6 · xrp-mobile"
          back={<SessionPaneBack href="#taskboard">Biometric unlock on Android</SessionPaneBack>}
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <SessionPaneHeader state="failed" name="retriever eval" stateLabel="Failed" meta="codex · gpt-5 · atlas" />
      </div>
    </div>
  );
}
