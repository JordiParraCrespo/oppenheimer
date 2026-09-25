import { QueryBase } from '@oppenheimer/backend-ddd';

/** One catalog flag and its targeting. Fails `FLAG_001` for a key the catalog does not declare. */
export class FindFeatureFlagQuery extends QueryBase {
  readonly key: string;

  constructor(key: string) {
    super();
    this.key = key;
  }
}
