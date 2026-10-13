import { Panel } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';

/**
 * A titled block on the hosts settings page. The caller says what goes in the
 * header, what an empty block shows and what sits under the rows.
 */
export function HostPanel({
  title,
  header,
  empty,
  renderFooter,
  children,
}: {
  title: string;
  header?: { meta: ReactNode; action?: ReactNode };
  empty?: { when: boolean; show: ReactNode };
  renderFooter?: () => ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel
      title={title}
      meta={
        header ? (
          <>
            {header.meta}
            {header.action}
          </>
        ) : undefined
      }
    >
      {empty?.when ? empty.show : children}
      {renderFooter ? <div className="flex justify-end">{renderFooter()}</div> : null}
    </Panel>
  );
}
