import { TokenSentence, TriggerCard } from '@oppenheimer/design-system-web';
import { Clock } from '@oppenheimer/design-system-web/icons';
import { useLocale } from '@oppenheimer/frontend-web';
import {
  SCHEDULE_FREQUENCIES,
  SCHEDULE_MAX_DAY_OF_MONTH,
  timeZoneAbbreviation,
} from '@oppenheimer/shared/automations';
import { useTranslation } from 'react-i18next';
import { type ScheduleCard, withFrequency } from '../lib/automation-draft';
import { localDate, pad2, viewerTimeZone, wallClock } from '../lib/time';
import { calendarDate, daysText, WEEK_ORDER, weekdayName } from '../lib/trigger-text';
import { ChoiceToken } from './choice-token';
import { GridToken } from './grid-token';
import { MultiToken } from './multi-token';
import { SchedulePreview } from './schedule-preview';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const QUARTERS = [0, 15, 30, 45];
const FIVES = Array.from({ length: 12 }, (_, i) => i * 5);

/**
 * A schedule trigger as a sentence of tokens (the frame's editor):
 * "[Weekly] on [Mon, Wed] at [09:00] CEST", each token opening its own
 * choices, with the preview line under it. The rule is wall time in the
 * zone it was set in; the zone's short name closes the sentence.
 */
export function ScheduleTriggerCard({
  card,
  now,
  onChange,
  onRemove,
}: {
  card: ScheduleCard;
  /** When the card was opened: what "tomorrow" and "past" are measured from. */
  now: number;
  onChange: (card: ScheduleCard) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const patch = (fields: Partial<ScheduleCard>) => onChange({ ...card, ...fields });
  const minutes = QUARTERS.includes(card.minute)
    ? QUARTERS
    : [...QUARTERS, card.minute].sort((a, b) => a - b);

  const today = localDate(now, card.timezone);
  const start = new Date(`${today}T12:00:00Z`);
  // A five-week calendar from this week's Monday.
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const dates = Array.from({ length: 35 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });

  return (
    <TriggerCard
      icon={<Clock />}
      onRemove={onRemove}
      removeLabel={t('automations.editor.removeTrigger')}
      preview={<SchedulePreview card={card} />}
    >
      <TokenSentence>
        <ChoiceToken
          size="md"
          label={t(`automations.frequency.${card.frequency}.label`)}
          value={card.frequency}
          options={SCHEDULE_FREQUENCIES.map((frequency) => ({
            value: frequency,
            label: t(`automations.frequency.${frequency}.label`),
            description: t(`automations.frequency.${frequency}.desc`),
          }))}
          onValueChange={(frequency) =>
            onChange(withFrequency(card, frequency as ScheduleCard['frequency'], now))
          }
        />
        {card.frequency === 'once' ? (
          <>
            <span>{t('automations.editor.on')}</span>
            <GridToken
              mono={false}
              label={calendarDate(card.date, locale)}
              panes={[
                {
                  label: '',
                  columns: 7,
                  value: card.date ?? null,
                  closes: true,
                  cells: dates.map((date) => ({
                    value: date,
                    label: String(Number(date.slice(8))),
                    disabled: date < today,
                  })),
                  onValueChange: (date) => patch({ date }),
                },
              ]}
            />
          </>
        ) : null}
        {card.frequency === 'weekly' ? (
          <>
            <span>{t('automations.editor.on')}</span>
            <MultiToken
              label={daysText(card.days ?? [], locale, t)}
              heading={t('automations.editor.days')}
              value={(card.days ?? []).map(String)}
              options={WEEK_ORDER.map((day) => ({
                value: String(day),
                label: weekdayName(day, locale),
              }))}
              onValueChange={(days) => patch({ days: days.map(Number) })}
            />
          </>
        ) : null}
        {card.frequency === 'monthly' ? (
          <>
            <span>{t('automations.editor.onThe')}</span>
            <GridToken
              label={String(card.dayOfMonth ?? 1)}
              panes={[
                {
                  label: t('automations.editor.dayOfMonth'),
                  columns: 7,
                  value: String(card.dayOfMonth ?? 1),
                  closes: true,
                  cells: Array.from({ length: SCHEDULE_MAX_DAY_OF_MONTH }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  })),
                  onValueChange: (day) => patch({ dayOfMonth: Number(day) }),
                },
              ]}
            />
          </>
        ) : null}
        <span>{t('automations.editor.at')}</span>
        {card.frequency === 'hourly' ? (
          <GridToken
            label={`:${pad2(card.minute)}`}
            panes={[
              {
                label: t('automations.editor.minutesPast'),
                columns: 6,
                value: String(card.minute),
                closes: true,
                cells: FIVES.map((minute) => ({
                  value: String(minute),
                  label: `:${pad2(minute)}`,
                })),
                onValueChange: (minute) => patch({ minute: Number(minute) }),
              },
            ]}
          />
        ) : (
          <GridToken
            label={wallClock(card.hour, card.minute)}
            panes={[
              {
                label: t('automations.editor.hour'),
                columns: 6,
                value: String(card.hour),
                cells: HOURS.map((hour) => ({ value: String(hour), label: pad2(hour) })),
                onValueChange: (hour) => patch({ hour: Number(hour) }),
              },
              {
                label: t('automations.editor.minute'),
                columns: minutes.length === 5 ? 5 : 4,
                value: String(card.minute),
                closes: true,
                cells: minutes.map((minute) => ({
                  value: String(minute),
                  label: `:${pad2(minute)}`,
                })),
                onValueChange: (minute) => patch({ minute: Number(minute) }),
              },
            ]}
          />
        )}
        <span>{timeZoneAbbreviation(card.timezone || viewerTimeZone(), new Date(now))}</span>
      </TokenSentence>
    </TriggerCard>
  );
}
