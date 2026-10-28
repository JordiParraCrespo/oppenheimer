import type { ChatTranscriptImage } from '@oppenheimer/frontend-consumer';
import { ChatImageGallery } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Images in a session's chat as tiles that open whole over the page: the
 * ones pasted with a prompt, or the ones a call's result carried, a
 * screenshot the agent read. Each is named after `source`, the file the call
 * read, when there is one, and numbered when there are several.
 */
export function ChatImages({
  images,
  source = null,
  align = 'start',
}: {
  images: readonly ChatTranscriptImage[];
  source?: string | null;
  /** `end` for a prompt's images, over its card on the right. */
  align?: 'start' | 'end';
}) {
  const { t } = useTranslation();
  const base = source?.split(/[\\/]/).at(-1) || t('common.chat.images.pasted');
  const gallery = (
    <ChatImageGallery
      images={images.map((image, index) => ({
        key: `${index}`,
        name: images.length > 1 ? `${base} (${index + 1})` : base,
        src: image.src ?? undefined,
      }))}
    />
  );
  if (align === 'end') return gallery;
  return <div className="flex flex-wrap gap-1.5">{gallery}</div>;
}
