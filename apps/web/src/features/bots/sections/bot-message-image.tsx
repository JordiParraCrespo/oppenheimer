import { ChatImage } from '@oppenheimer/design-system-web';
import { useBotImage } from '@oppenheimer/frontend-consumer/react';
import type { BotAttachment } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { useObjectUrl } from '@/features/bots/hooks/use-object-url';

/**
 * An image a message of yours carried, above its bubble: read through the
 * API, which serves it only to whoever may see the chat, and opened full
 * size in a new tab. While it loads the tile holds its place; one that
 * cannot be read says so on the tile.
 */
export function BotMessageImage({
  botId,
  attachment,
}: {
  botId: string;
  attachment: BotAttachment;
}) {
  const { t } = useTranslation();
  const { data, isError } = useBotImage(botId, attachment.id);
  const src = useObjectUrl(data);
  const name = attachment.name || t('bots.chat.images.pasted');
  if (!src) {
    return (
      <ChatImage
        size="lg"
        alt={isError ? t('bots.chat.images.unavailable') : name}
        title={isError ? t('bots.chat.images.unavailable') : name}
        pending={!isError}
      />
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      aria-label={t('bots.chat.images.open', { name })}
      className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <ChatImage src={src} alt={name} size="lg" />
    </a>
  );
}
