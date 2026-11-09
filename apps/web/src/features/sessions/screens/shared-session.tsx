import { QueryState, RouteError } from '@oppenheimer/frontend-web';
import { SharedFrame } from '../components/shared-frame';
import { SharedSessionSkeleton } from '../components/shared-session-skeleton';
import { shareRefusalOf } from '../lib/share-session';
import { SharedRefusal } from '../sections/shared-refusal';
import { SharedSessionPane } from '../sections/shared-session-pane';

/**
 * A session as a guest opens it, `/s/<slug>`. The pane reads the share under
 * Suspense; this draws its placeholder and a first failure, where a refusal
 * (sign in, not shared with you, not shared at all) is its own answer and
 * anything else is a failure with Try again.
 */
export function SharedSessionScreen({ slug }: { slug: string }) {
  return (
    <QueryState>
      <QueryState.Pending>
        <SharedFrame>
          <SharedSessionSkeleton />
        </SharedFrame>
      </QueryState.Pending>
      <QueryState.Error>
        {(error, retry) => {
          const refusal = shareRefusalOf(error);
          return refusal ? (
            <SharedRefusal refusal={refusal} slug={slug} />
          ) : (
            <RouteError error={error} onRetry={retry} />
          );
        }}
      </QueryState.Error>
      <QueryState.Data>
        <SharedSessionPane slug={slug} />
      </QueryState.Data>
    </QueryState>
  );
}
