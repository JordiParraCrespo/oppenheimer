import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  StepTab,
  StepTabs,
  StepTabsList,
  StepTabsPanel,
  Textarea,
} from '@oppenheimer/design-system-web';
import { Bot, Boxes, Cpu, GitBranch, Layers, Plus } from '@oppenheimer/design-system-web/icons';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The wizard's steps, in order; a tab's value is its index. */
const STEPS = ['task', 'trigger', 'where'] as const;

/**
 * New automation (`product/versions/mvp/13-automations.md`, the 2026-09-27
 * export): a 640px dialog over the console with three steps under its title
 * — Task, Trigger, Where it runs — and a footer that walks them: the line
 * that says what is still missing, Back, Cancel on the first step, Next
 * while a step is unfinished, Create on the last.
 *
 * The shell of the wizard, ahead of the API: the Task step's two fields are
 * live and gate Next the way the frame does (a name and the work); the
 * Trigger step names the rule and holds the row that will add one; the Where
 * step draws its two groups of rows — the project it was opened for already
 * named — with no picker behind them yet. Nothing is kept: Create stays off
 * until the control plane names the resource.
 *
 * `projectId` is where a project header's plus opened it from.
 */
export function AutomationEditorDialog({
  projectId,
  onClose,
}: {
  projectId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  // The named project, for the Where step's first row. Read here rather than
  // handed in: the sidebar and the overview both open this, and neither
  // holds the row.
  const { data: project } = useProjects({
    select: (rows) => rows.find((row) => row.id === projectId),
  });

  // What each step needs before the next opens (`SessionsConsole.dc.html`,
  // `done`): the task is a name and the work; a trigger is one added, which
  // arrives with the API; the last step never blocks.
  const done = [name.trim().length > 0 && prompt.trim().length > 0, false, true];
  const reachable = (index: number) => done.slice(0, index).every(Boolean);
  const missing = !name.trim()
    ? t('automations.editor.missing.name')
    : !prompt.trim()
      ? t('automations.editor.missing.prompt')
      : t('automations.editor.missing.trigger');

  const where = [
    {
      group: t('automations.editor.code'),
      rows: [
        {
          key: 'project',
          icon: <Boxes />,
          label: t('automations.editor.project'),
          value: project?.name,
        },
        { key: 'repositories', icon: <GitBranch />, label: t('automations.editor.repositories') },
      ],
    },
    {
      group: t('automations.editor.runsOn'),
      rows: [
        { key: 'host', icon: <Cpu />, label: t('automations.editor.host') },
        { key: 'agent', icon: <Bot />, label: t('automations.editor.agent') },
        { key: 'model', icon: <Layers />, label: t('automations.editor.model') },
      ],
    },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('automations.editor.newTitle')}</DialogTitle>
        </DialogHeader>

        <StepTabs
          value={String(step)}
          onValueChange={(next) => setStep(Number(next))}
          className="min-h-0 flex-1"
        >
          <StepTabsList aria-label={t('automations.editor.stepsLabel')} className="mx-7 mt-4.5">
            {STEPS.map((key, index) => (
              <StepTab
                key={key}
                value={String(index)}
                number={index + 1}
                done={done[index] && index !== step && index < 2}
                disabled={!reachable(index)}
              >
                {t(`automations.editor.steps.${key}`)}
              </StepTab>
            ))}
          </StepTabsList>

          <DialogBody>
            <div className="flex min-h-75 flex-col gap-5">
              <StepTabsPanel value="0">
                <Field>
                  <FieldLabel htmlFor="automation-name">{t('automations.editor.name')}</FieldLabel>
                  <Input
                    id="automation-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t('automations.editor.namePlaceholder')}
                    autoFocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="automation-prompt">
                    {t('automations.editor.prompt')}
                  </FieldLabel>
                  <Textarea
                    id="automation-prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={t('automations.editor.promptPlaceholder')}
                    className="min-h-28"
                  />
                  <FieldDescription>{t('automations.editor.promptHint')}</FieldDescription>
                </Field>
              </StepTabsPanel>

              <StepTabsPanel value="1">
                <div className="flex flex-col gap-3">
                  <span className="text-[13px] text-fg-muted">
                    {t('automations.editor.anyTrigger')}
                  </span>
                  {/* The row that adds one: the schedule and the GitHub events
                    behind it arrive with the API, so it stays off and says why. */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    disabled
                  >
                    <Plus />
                    {t('automations.editor.addTrigger')}
                  </Button>
                  <FieldDescription>{t('automations.editor.triggersSoon')}</FieldDescription>
                </div>
              </StepTabsPanel>

              <StepTabsPanel value="2">
                {where.map((group) => (
                  <div key={group.group} className="flex flex-col gap-2">
                    <span className="eyebrow">{group.group}</span>
                    <div className="flex flex-col rounded-lg border border-border-subtle">
                      {group.rows.map((row) => (
                        <div
                          key={row.key}
                          className="flex min-h-13 items-center gap-3 border-t border-border-subtle pr-2 pl-4 first:border-t-0"
                        >
                          <span className="flex shrink-0 text-fg-subtle [&_svg]:size-4">
                            {row.icon}
                          </span>
                          <span className="min-w-0 flex-1 text-sm text-fg">{row.label}</span>
                          <span className="flex h-8 items-center rounded-pill px-3 text-[13.5px] text-fg-subtle">
                            {row.value ?? t('automations.editor.notSet')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <FieldDescription>{t('automations.editor.runsHint')}</FieldDescription>
              </StepTabsPanel>
            </div>
          </DialogBody>
        </StepTabs>

        <DialogFooter className="items-center">
          <span className="min-w-0 flex-1 text-[12.5px] text-pretty text-fg-muted">{missing}</span>
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
              {t('automations.editor.back')}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!done[step]} onClick={() => setStep(step + 1)}>
              {t('automations.editor.next')}
            </Button>
          ) : (
            <Button type="button" disabled>
              {t('automations.editor.create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
