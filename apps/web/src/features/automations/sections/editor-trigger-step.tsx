import {
  AddRow,
  BrandGlyph,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useNow,
} from '@oppenheimer/design-system-web';
import { Clock } from '@oppenheimer/design-system-web/icons';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { GITHUB_EVENT_TYPES, SCHEDULE_FREQUENCIES } from '@oppenheimer/shared/automations';
import { MAX_AUTOMATION_TRIGGERS } from '@oppenheimer/shared/schemas/automation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduleTriggerCard } from '../components/schedule-trigger-card';
import { githubCard, scheduleCard, type TriggerCard } from '../lib/automation-draft';
import { viewerTimeZone } from '../lib/time';
import { eventLabel } from '../lib/trigger-text';
import { GithubTriggerCard } from './github-trigger-card';

/**
 * The editor's Trigger step: "Any trigger starts a run.", a card per
 * trigger, and Add trigger, whose menu groups the schedules and the GitHub
 * events with a line each. A new schedule is set in the viewer's own zone.
 */
export function EditorTriggerStep({
  triggers,
  repositories,
  onChange,
}: {
  triggers: TriggerCard[];
  repositories: { id: number; name: string }[];
  onChange: (triggers: TriggerCard[]) => void;
}) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);
  const [adding, setAdding] = useState(false);
  const replace = (card: TriggerCard) =>
    onChange(triggers.map((current) => (current.key === card.key ? card : current)));
  const remove = (key: string) => onChange(triggers.filter((current) => current.key !== key));
  const full = triggers.length >= MAX_AUTOMATION_TRIGGERS;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-fg-muted">{t('automations.editor.triggerLead')}</span>
      {triggers.map((card) =>
        card.source === 'schedule' ? (
          <ScheduleTriggerCard
            key={card.key}
            card={card}
            now={now}
            onChange={replace}
            onRemove={() => remove(card.key)}
          />
        ) : (
          <GithubTriggerCard
            key={card.key}
            card={card}
            repositories={repositories}
            onChange={replace}
            onRemove={() => remove(card.key)}
          />
        ),
      )}
      {full ? null : (
        <DropdownMenu open={adding} onOpenChange={setAdding}>
          <DropdownMenuTrigger render={<AddRow open={adding} />}>
            {triggers.length
              ? t('automations.editor.addAnother')
              : t('automations.editor.addTrigger')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-96 min-w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('automations.editor.groupSchedule')}</DropdownMenuLabel>
              {SCHEDULE_FREQUENCIES.map((frequency) => (
                <DropdownMenuItem
                  key={frequency}
                  onClick={() =>
                    onChange([...triggers, scheduleCard(frequency, now, viewerTimeZone())])
                  }
                >
                  <Clock />
                  <span className="flex flex-col">
                    <span>{t(`automations.frequency.${frequency}.label`)}</span>
                    <span className="text-xs text-fg-subtle">
                      {t(`automations.frequency.${frequency}.desc`)}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('automations.editor.groupGithub')}</DropdownMenuLabel>
              {GITHUB_EVENT_TYPES.map((event) => (
                <DropdownMenuItem
                  key={event}
                  disabled={!repositories.length}
                  onClick={() =>
                    onChange([
                      ...triggers,
                      githubCard(
                        event,
                        repositories.map((repository) => repository.id),
                      ),
                    ])
                  }
                >
                  <BrandGlyph name="github" size={14} />
                  <span className="flex flex-col">
                    <span>{eventLabel(event, t)}</span>
                    <span className="text-xs text-fg-subtle">
                      {t(`automations.event.${event}.desc`)}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
