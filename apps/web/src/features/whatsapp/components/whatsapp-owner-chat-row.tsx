import { SettingsListRow } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The reader's own chat with the number, first among People. It is always
 * theirs and always answered by the number's default bot ("Answers you"
 * above), so it has no tick and no picker: it says who answers instead.
 */
export function WhatsappOwnerChatRow({
  number,
  defaultBotName,
}: {
  /** The reader's confirmed number, `+digits`. */
  number: string;
  defaultBotName: string | null;
}) {
  const { t } = useTranslation();

  return (
    <SettingsListRow
      align="center"
      data-testid="whatsapp-owner-chat"
      meta={[t('settings.whatsapp.chats.person'), number].join(' · ')}
      actions={
        <span className="text-sm text-fg-muted">
          {defaultBotName
            ? t('settings.whatsapp.chats.defaultNamed', { bot: defaultBotName })
            : t('settings.whatsapp.chats.defaultNone')}
        </span>
      }
    >
      {/* Where the other rows' tick stands, so the names line up. */}
      <span className="flex items-center gap-3">
        <span className="size-4.5 shrink-0" aria-hidden />
        {t('settings.whatsapp.chats.you')}
      </span>
    </SettingsListRow>
  );
}
