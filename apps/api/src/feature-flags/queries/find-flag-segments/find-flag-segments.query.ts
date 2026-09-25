import { QueryBase } from '@oppenheimer/backend-ddd';
import type { FlagSegmentEntity } from '../../domain/flag-segment.entity';

/** A segment and the flags whose rules target it. */
export interface FlagSegmentView {
  entity: FlagSegmentEntity;
  usedBy: string[];
}

/** Every segment with the flags that use it — or just the one named by `key`. */
export class FindFlagSegmentsQuery extends QueryBase {
  readonly key?: string;

  constructor(key?: string) {
    super();
    this.key = key;
  }
}
