import {
  ComposerToolButton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@oppenheimer/design-system-web';
import { GraduationCapIcon } from '@oppenheimer/design-system-web/icons';
import type { BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { botAdvisorOptions } from '@/features/bots/lib/bot-engine';

/** The radio value that stands for no advisor: never a model id. */
const OFF = 'off';

/**
 * The bot's advisor, beside its model in the composer's foot row: a stronger
 * Claude model its turns may consult mid-turn (Anthropic's advisor tool), or
 * none. Drawn only when the bot's model takes one, so a GLM, OpenAI or Grok
 * bot shows nothing; the API keeps the pair valid when the model changes.
 * Each pick is the bot's from then on; the caller saves it.
 */
export function BotAdvisorChip({
  provider,
  model,
  value,
  disabled,
  onValueChange,
}: {
  provider: BotProvider;
  model: string | null;
  /** The advisor's model id; null when it has none. */
  value: string | null;
  disabled?: boolean;
  onValueChange: (advisorModel: string | null) => void;
}) {
  const { t } = useTranslation();
  const options = botAdvisorOptions(provider, model);
  if (options.length === 0) return null;
  const current = options.find((option) => option.id === value);
  const label = current
    ? t('bots.chat.advisor.on', { model: current.label })
    : t('bots.chat.advisor.off');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ComposerToolButton
            icon={<GraduationCapIcon />}
            tone="muted"
            disabled={disabled}
            aria-label={t('bots.chat.advisor.label')}
          />
        }
        title={current ? `${label}. ${t('bots.chat.advisor.description')}` : label}
      >
        {/* In a narrow chat the button is its glyph alone, as the level's is. */}
        <span className="@max-md/composer-meta:sr-only">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-[220px]">
        <DropdownMenuRadioGroup
          value={current ? current.id : OFF}
          onValueChange={(next) => onValueChange(next === OFF ? null : String(next))}
        >
          <DropdownMenuLabel>{t('bots.chat.advisor.label')}</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              density="compact"
              // As the level's menu: a radio item keeps Base UI's menu open,
              // which would leave the send button behind its backdrop.
              closeOnClick
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem value={OFF} density="compact" closeOnClick>
            {t('bots.chat.advisor.off')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
