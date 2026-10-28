import {
  ChatImage,
  ChatImageButton,
  ChatImageViewer,
  ChatImageViewerImage,
} from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatGalleryImage } from '../lib/chat-images';

/**
 * The images a chat message carries, as tiles that open where they are: a
 * press on one opens it whole in the viewer over the page, and ← and → go
 * through the others of the same message, the way Claude's own chat shows
 * them. An image still loading holds its tile, breathing; one that could
 * not be read says so on it and does not open.
 */
export function ChatImageGallery({
  images,
  size = 'lg',
}: {
  images: readonly ChatGalleryImage[];
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  const shown = open === null ? undefined : images[open];
  return (
    <>
      {images.map((image, index) =>
        image.src ? (
          <ChatImageButton
            key={image.key}
            label={t('common.chat.images.open', { name: image.name })}
            onClick={() => setOpen(index)}
          >
            <ChatImage src={image.src} alt={image.name} size={size} />
          </ChatImageButton>
        ) : (
          <ChatImage
            key={image.key}
            size={size}
            alt={image.failed ? t('common.chat.images.unavailable') : image.name}
            title={image.failed ? t('common.chat.images.unavailable') : image.name}
            pending={!image.failed}
          />
        ),
      )}
      <ChatImageViewer
        open={shown !== undefined}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        index={open ?? 0}
        count={images.length}
        onIndexChange={setOpen}
        name={shown?.name ?? ''}
        download={shown?.src ? { href: shown.src, filename: shown.name } : undefined}
        labels={{
          close: t('common.close'),
          previous: t('common.chat.images.previous'),
          next: t('common.chat.images.next'),
          download: t('common.chat.images.download'),
          position: (position, count) =>
            t('common.chat.images.position', { position, total: count }),
        }}
      >
        <ChatImageViewerImage src={shown?.src} alt={shown?.name ?? ''} />
      </ChatImageViewer>
    </>
  );
}
