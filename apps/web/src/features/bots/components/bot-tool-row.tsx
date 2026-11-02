import { Button, PillGroup, PillGroupItem, SettingsRow } from '@oppenheimer/design-system-web';
import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import { BOT_TOOL_DECISIONS, type BotToolDecision } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * One tool in Settings → Permissions: its name and what it does, then Allow,
 * Ask and Off with where it stands lit. Allow is not offered for a tool
 * decided call by call (merging), and the hint says so. A tool the owner set
 * offers Default, which hands it back to the preset.
 */
export function BotToolRow({
  tool,
  pending,
  onDecide,
}: {
  tool: BotToolSetting;
  pending: boolean;
  onDecide: (decision: BotToolDecision | 'default') => void;
}) {
  const { t } = useTranslation();
  const hint = tool.perCallOnly
    ? `${tool.description} ${t('bots.settings.permissions.perCall')}`
    : tool.description;

  return (
    <SettingsRow label={<span className="font-mono">{tool.name}</span>} hint={hint}>
      {tool.set !== null ? (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => onDecide('default')}>
          {t('bots.settings.permissions.reset')}
        </Button>
      ) : null}
      <PillGroup
        value={tool.decision}
        onValueChange={(next) => onDecide(next as BotToolDecision)}
        aria-label={t('bots.settings.permissions.decisionFor', { tool: tool.name })}
        disabled={pending}
      >
        {BOT_TOOL_DECISIONS.map((decision) => (
          <PillGroupItem
            key={decision}
            value={decision}
            disabled={decision === 'allow' && tool.perCallOnly}
          >
            {t(`bots.settings.permissions.decisions.${decision}`)}
          </PillGroupItem>
        ))}
      </PillGroup>
    </SettingsRow>
  );
}
