import type { InboxReportEntity } from '@oppenheimer/frontend-consumer';
import { useInboxReportImages } from '@oppenheimer/frontend-consumer/react';
import { ChatImageGallery, useObjectUrls } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The pictures a report carries, as tiles on its card: read through the API,
 * which serves them only to whoever may read the report, and opened whole in
 * the viewer over the page, ← and → through the others. While one loads its
 * tile holds its place; one that cannot be read says so on the tile.
 */
export function InboxReportImages({ report }: { report: InboxReportEntity }) {
  const { t } = useTranslation();
  const reads = useInboxReportImages(
    report.id,
    report.images.map((image) => image.id),
  );
  const urls = useObjectUrls(reads.blobs);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is a form's group; these are pictures
    <div role="group" aria-label={t('inbox.report.images')} className="flex flex-wrap gap-2">
      <ChatImageGallery
        images={report.images.map((image, index) => ({
          key: image.id,
          name: image.name || t('inbox.report.image', { n: index + 1 }),
          src: urls[index],
          failed: reads.failed[index],
        }))}
      />
    </div>
  );
}
