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
 * the field (`problem`), never silently dropped. Held per bot: moving to
 * another bot's chat starts with none.
 */
export function useBotImages(botId: string, takesImages: boolean, model: string) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const upload = useUploadBotImage();
  const [held, setHeld] = useState<{ botId: string; images: HeldImage[] }>({
    botId,
    images: [],
  });
  const [refused, setRefused] = useState<{ botId: string; reason: string } | null>(null);
  const images = held.botId === botId ? held.images : [];

  const update = (key: string, change: Partial<HeldImage>) =>
    setHeld((current) =>
      current.botId === botId
        ? {
            botId,
            images: current.images.map((image) =>
              image.key === key ? { ...image, ...change } : image,
            ),
          }
        : current,
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
    setRefused(reason ? { botId, reason } : null);
    if (accepted.length === 0) return;
    setHeld({ botId, images: [...images, ...accepted] });
    for (const image of accepted) {
      upload
        .mutateAsync({ id: botId, file: image.file })
        .then((stored) => update(image.key, { status: 'ready', attachmentId: stored.id }))
        .catch((error: unknown) => update(image.key, { status: 'failed', error }));
    }
  }

  function remove(key: string) {
    setRefused(null);
    setHeld({ botId, images: images.filter((image) => image.key !== key) });
  }

  function clear() {
    setRefused(null);
    setHeld({ botId, images: [] });
  }

  const failed = images.find((image) => image.status === 'failed');
  const problem =
    (refused?.botId === botId ? refused.reason : null) ??
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
