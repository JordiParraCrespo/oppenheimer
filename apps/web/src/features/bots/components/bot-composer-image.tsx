import { ChatImage, ChatImageRemove } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { useObjectUrl } from '@/features/bots/hooks/use-object-url';
import type { HeldImage } from '@/features/bots/lib/bot-images';

/**
 * An image the composer holds for the next message: the picked file itself
 * as the thumbnail, breathing while it uploads and ringed when the API
 * refused it, with the cross that takes it off the message.
 */
export function BotComposerImage({ image, onRemove }: { image: HeldImage; onRemove: () => void }) {
  const { t } = useTranslation();
  const src = useObjectUrl(image.file);
  const name = image.file.name || t('bots.chat.images.pasted');
  return (
    <ChatImage
      src={src}
      alt={name}
      title={name}
      pending={image.status === 'uploading'}
      invalid={image.status === 'failed'}
    >
      <ChatImageRemove label={t('bots.chat.images.remove', { name })} onClick={onRemove} />
    </ChatImage>
  );
}
