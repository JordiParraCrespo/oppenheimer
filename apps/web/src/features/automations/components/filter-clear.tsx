import type * as React from 'react';

/** The Clear link at the end of a `FilterRow`'s facets, shown while a filter is on. */
export function FilterClear({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-1 text-sm text-fg-muted transition-colors duration-fast hover:text-fg"
    >
      {children}
    </button>
  );
}
