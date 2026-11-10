import { ChatComposer, IconButton, Skeleton } from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus, PageBar } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { BotTranscriptSkeleton } from './bot-transcript-skeleton';

function noop() {}

/** A composer chip's place: the 30px tool button, its label a bar. */
const chip = (width: string) => (
  <span aria-hidden className="flex h-[30px] items-center px-2.5">
    <Skeleton shape="sm" className={`h-3 ${width}`} />
  </span>
);

/**
 * A bot's chat before the bot answers, laid out as `BotChat` draws it: the
 * `PageBar` with the face and name as bars and the actions menu in its slot,
 * the transcript's ghost in the scrolling pane at its padding, and the
 * composer's own frame at its height, the box off and its chips as bars, so
 * nothing moves when the bot lands but the bars turning into words.
 */
export function BotChatSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col">
      <LoadingStatus />
      <PageBar
        leading={<Skeleton shape="pill" className="size-6.5" />}
        title={
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3.5 w-32" />
          </span>
        }
        actions={
          <IconButton aria-label={t('bots.chat.actions')} size="sm" variant="quiet" disabled>
            <Ellipsis />
          </IconButton>
        }
      />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-6 pb-10 sm:px-8">
        <BotTranscriptSkeleton />
      </div>
      <div className="px-4 pb-4 sm:px-8">
        <div className="mx-auto flex w-full max-w-190 flex-col gap-2">
          <ChatComposer
            inert
            disabled
            value=""
            onValueChange={noop}
            onSubmit={noop}
            onAttach={noop}
            tools={chip('w-24')}
            engine={
              <>
                {chip('w-20')}
                {chip('w-14')}
              </>
            }
            labels={{
              send: t('bots.chat.send'),
              stop: t('bots.chat.stop'),
              attach: t('bots.chat.images.attach'),
            }}
          />
        </div>
      </div>
    </div>
  );
}
