import { FileIcon, Link } from '@oppenheimer/design-system-web';
import type { ChatSharedFile } from '@oppenheimer/frontend-consumer';
import { ChatImageGallery, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { fileSize, pathParts } from '../lib/chat-blocks';
import { ChatCommandOutput } from './chat-command-output';

/**
 * A file the agent showed the person (`runner sessions send-file`): its
 * line about it, then the file as far as the link carried it — an image as
 * a tile that opens whole, a small text file as its text — and under it the
 * file's name, size and folder on the host, where the file itself stays.
 */
export function ChatSharedFileCard({ file }: { file: ChatSharedFile }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { folder } = pathParts(file.path);
  return (
    <figure className="m-0 flex flex-col gap-1.5">
      {file.caption ? <p className="m-0 text-fg">{file.caption}</p> : null}
      {file.preview ? (
        <div className="flex">
          <ChatImageGallery images={[{ key: file.id, name: file.name, src: file.preview }]} />
        </div>
      ) : null}
      {file.text !== null ? <ChatCommandOutput text={file.text} failed={false} /> : null}
      <figcaption className="flex min-w-0 items-center gap-1.5 text-fg-muted text-xs">
        <FileIcon path={file.name} />
        <span className="shrink-0 text-fg">{file.name}</span>
        <span className="shrink-0">{fileSize(file.size, locale)}</span>
        {folder ? (
          <span className="min-w-0 truncate font-mono text-fg-subtle" title={file.path}>
            {folder}
          </span>
        ) : null}
        {file.text !== null ? (
          <Link
            muted
            className="ml-auto shrink-0"
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(file.text)}`}
            download={file.name}
          >
            {t('common.chat.images.download')}
          </Link>
        ) : null}
      </figcaption>
      {!file.preview && file.text === null ? (
        <p className="m-0 text-fg-subtle text-xs">{t('sessions.chat.file.onHost')}</p>
      ) : null}
    </figure>
  );
}
