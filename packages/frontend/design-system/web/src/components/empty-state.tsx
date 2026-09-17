import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";

/**
 * Compound empty-state API with the Adri Rodrigo visual treatment.
 *
 * @example
 * ```tsx
 * <EmptyState>
 *   <EmptyState.Header>
 *     <EmptyState.Media variant="icon">
 *       <Globe />
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
