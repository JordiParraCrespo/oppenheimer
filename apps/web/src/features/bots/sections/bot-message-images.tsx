import { useBotImages } from '@oppenheimer/frontend-consumer/react';
import { ChatImageGallery } from '@oppenheimer/frontend-web';
import type { BotAttachment } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { useObjectUrls } from '@/features/bots/hooks/use-object-urls';

/**
 * The images a message of yours carried, above its bubble: read through the
 * API, which serves them only to whoever may see the chat, and opened whole
 * in the viewer over the chat, ← and → through the others. While one loads
 * its tile holds its place; one that cannot be read says so on the tile.
 */
export function BotMessageImages({
  botId,
  attachments,
}: {
  botId: string;
  attachments: readonly BotAttachment[];
}) {
  const { t } = useTranslation();
  const reads = useBotImages(
    botId,
    attachments.map((attachment) => attachment.id),
  );
  const urls = useObjectUrls(reads.blobs);
  return (
    <ChatImageGallery
      images={attachments.map((attachment, index) => ({
        key: attachment.id,
        name: attachment.name || t('bots.chat.images.pasted'),
        src: urls[index],
        failed: reads.failed[index],
      }))}
    />
  );
}
