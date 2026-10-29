import {
  IconButton,
  SettingsAddRow,
  SettingsGroup,
  SettingsListRow,
} from '@oppenheimer/design-system-web';
import { X } from '@oppenheimer/design-system-web/icons';
import {
  useAddBotPermissionRule,
  useDeleteBotPermissionRule,
  useSuspenseBotPermissions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import {
  BOT_PERMISSION_RULE_MAX,
  BOT_PERMISSION_RULES_MAX,
  type BotPermissionRuleEffect,
} from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The owner's rules of one kind, in their words: Ask first when… (a match
 * raises a card even where the tool would run) or Allow without asking
 * when… (a match lets a call that would ask run). A reviewer on the bot's own
 * model reads them before an asking call; an ask rule wins. This owns the
 * add, whose draft is the add row's.
 */
export function BotPermissionRules({
  botId,
  effect,
}: {
  botId: string;
  effect: BotPermissionRuleEffect;
}) {
  const { t } = useTranslation();
  const { data: permissions } = useSuspenseBotPermissions(botId);
  const [draft, setDraft] = useState('');
  const add = useAddBotPermissionRule({ onSuccess: () => setDraft('') });
  const remove = useDeleteBotPermissionRule();
  const rules = permissions.rulesOf(effect);
  const text = draft.trim();
  const full = permissions.rules.length >= BOT_PERMISSION_RULES_MAX;

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 className="eyebrow m-0">{t(`bots.settings.permissions.rules.${effect}.title`)}</h2>
        <p className="m-0 text-sm text-fg-muted">
          {t(`bots.settings.permissions.rules.${effect}.hint`)}
        </p>
      </div>
      {/* A refetch that fails is not drawn here: the tools section below draws it once. */}
      <SettingsGroup>
        {rules.length === 0 ? (
          <SettingsListRow muted>{t('bots.settings.permissions.rules.empty')}</SettingsListRow>
        ) : (
          rules.map((rule) => (
            <SettingsListRow
              key={rule.id}
              align="center"
              actions={
                <IconButton
                  variant="quiet"
                  size="sm"
                  aria-label={t('bots.settings.permissions.rules.remove', { rule: rule.text })}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: botId, ruleId: rule.id })}
                >
                  <X />
                </IconButton>
              }
            >
              {rule.text}
            </SettingsListRow>
          ))
        )}
        <SettingsAddRow
          value={draft}
          onValueChange={(next) => setDraft(next.slice(0, BOT_PERMISSION_RULE_MAX))}
          onAdd={() => add.mutate({ id: botId, effect, text })}
          canAdd={text !== '' && !full && !add.isPending}
          placeholder={t(`bots.settings.permissions.rules.${effect}.placeholder`)}
          addLabel={t('bots.settings.permissions.rules.add')}
          aria-label={t(`bots.settings.permissions.rules.${effect}.new`)}
        />
      </SettingsGroup>
      <ErrorAlert
        error={add.error ?? remove.error}
        fallback={t('bots.settings.permissions.saveFailed')}
        onDismiss={() => {
          add.reset();
          remove.reset();
        }}
      />
    </section>
  );
}
