import { useUploadBotImage } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { BOT_MESSAGE_IMAGES_MAX } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type HeldImage, imageRefusal } from '@/features/bots/lib/bot-images';

/**
 * The images the composer holds for a bot's next message: each uploaded the
 * moment it is picked, pasted or dropped, so a refusal is said while the
 * person still writes, and the message names the uploads when it is sent.
 * A file the composer will not hold, or one the API refused, is said under
 * the field (`problem`), never silently dropped. The images are this
 * composer's: the chat keys the composer by its bot, so another bot's chat
 * starts with none.
 */
export function useBotImages(botId: string, takesImages: boolean, model: string) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const upload = useUploadBotImage();
  const [images, setImages] = useState<HeldImage[]>([]);
  const [refused, setRefused] = useState<string | null>(null);

  const update = (key: string, change: Partial<HeldImage>) =>
    setImages((current) =>
      current.map((image) => (image.key === key ? { ...image, ...change } : image)),
    );

  function hold(files: File[]) {
    const accepted: HeldImage[] = [];
    let reason: string | null = null;
    for (const file of files) {
      const name = file.name || t('bots.chat.images.pasted');
      const refusal = imageRefusal(file, images.length + accepted.length, takesImages);
      if (refusal) {
        reason = t(`bots.chat.images.${refusal}`, { name, model, max: BOT_MESSAGE_IMAGES_MAX });
        continue;
      }
      accepted.push({
        key: crypto.randomUUID(),
        file,
        status: 'uploading',
        attachmentId: null,
        error: null,
      });
    }
    setRefused(reason);
    if (accepted.length === 0) return;
    setImages((current) => [...current, ...accepted]);
    for (const image of accepted) {
      upload
        .mutateAsync({ id: botId, file: image.file })
        .then((stored) => update(image.key, { status: 'ready', attachmentId: stored.id }))
        .catch((error: unknown) => update(image.key, { status: 'failed', error }));
    }
  }

  function remove(key: string) {
    setRefused(null);
    setImages((current) => current.filter((image) => image.key !== key));
  }

  function clear() {
    setRefused(null);
    setImages([]);
  }

  const failed = images.find((image) => image.status === 'failed');
  const problem =
    refused ??
    (failed
      ? (resolveError(
          failed.error,
          t('bots.chat.images.uploadFailed', {
            name: failed.file.name || t('bots.chat.images.pasted'),
          }),
        )?.message ?? null)
      : null);

  return { images, hold, remove, clear, problem };
}
