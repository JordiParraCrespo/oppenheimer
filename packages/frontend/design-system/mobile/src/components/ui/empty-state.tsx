import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './empty';

/**
 * Compound empty-state API, mirroring the web package.
 *
 * @example
 * ```tsx
 * <EmptyState>
 *   <EmptyState.Header>
 *     <EmptyState.Media variant="icon">
 *       <Icon as={Globe} size={24} />
 *     </EmptyState.Media>
 *     <EmptyState.Title>No domains yet</EmptyState.Title>
 *     <EmptyState.Description>Domains will appear here.</EmptyState.Description>
 *   </EmptyState.Header>
 * </EmptyState>
 * ```
 */
const EmptyState = Object.assign(Empty, {
  Content: EmptyContent,
  Description: EmptyDescription,
  Header: EmptyHeader,
  Media: EmptyMedia,
  Title: EmptyTitle,
});

export { EmptyState };
