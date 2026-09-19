import type { AccessScope } from '@oppenheimer/backend-authz';
import { QueryBase } from '@oppenheimer/backend-ddd';

/**
 * Does this project still hold sessions nobody has closed?
 *
 * The one question archiving a project has to ask, and the reason archiving ships
 * with the sessions slice rather than with `projects/`: only the module that owns
 * sessions can answer it, and a placeholder answering "no" would be fail-open on a
 * destructive path.
 *
 * It travels on the **query bus** rather than through a port, and the class lives
 * here rather than in `projects/` for a reason worth stating: the module that can
 * answer a question owns the question, and a bus message is published surface that
 * any module may dispatch. `projects/` imports this class and nothing else of this
 * module — no Nest import either way, so the two modules stay acyclic.
 *
 * When nothing handles it — a deployment built without sessions — the bus throws
 * and the archive refuses. That is the intended behaviour, not an accident.
 */
export class HasOpenSessionsQuery extends QueryBase {
  readonly scope: AccessScope;
  readonly projectId: string;

  constructor(props: { scope: AccessScope; projectId: string }) {
    super();
    this.scope = props.scope;
    this.projectId = props.projectId;
  }
}
