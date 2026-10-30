import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type {
  CiFindingAction,
  CiFindingConfidence,
  CiFindingFlake,
  CiFindingRelation,
} from '@oppenheimer/shared';

export interface CiFindingProps {
  organizationId: string;
  githubRepoId: number;
  number: number;
  /** The head commit the check failed on. */
  headSha: string;
  /** The check, as GitHub names it. */
  check: string;
  /** Why it failed, in a sentence or two. */
  rootCause: string;
  relation: CiFindingRelation;
  flake: CiFindingFlake;
  action: CiFindingAction;
  /** The action in words: what exactly to change, re-run or ask. */
  next: string;
  confidence: CiFindingConfidence;
  /** What it rests on: a line of the log, a file and line, a run. */
  evidence: string[];
  /** The person the record was made as; null once their account is gone. */
  recordedByUserId: string | null;
  /** The bot that made it, when a bot did; null otherwise or once it is gone. */
  recordedByBotId: string | null;
}

/**
 * What one failing check on a pull request's head came to
 * (`0.2-pull-requests.md`, "CI findings"): its cause, whether the change
 * caused it, whether it is a flake, what to do, and how sure, with the
 * evidence. Its invariants are structural (named, on a positive number,
 * resting on evidence); the closed sets and the lengths are the shared
 * schema's and the table's CHECKs, from the same constants. A second record
 * of the same check on the same commit replaces it.
 */
export class CiFindingEntity extends AggregateRoot<CiFindingProps> {
  static create(create: CreateEntityProps<CiFindingProps>): CiFindingEntity {
    return new CiFindingEntity(create);
  }

  static record(props: CiFindingProps): CiFindingEntity {
    const finding = new CiFindingEntity({ id: randomUUID(), props });
    finding.validate();
    return finding;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get githubRepoId(): number {
    return this.props.githubRepoId;
  }
  get number(): number {
    return this.props.number;
  }
  get headSha(): string {
    return this.props.headSha;
  }
  get check(): string {
    return this.props.check;
  }
  get rootCause(): string {
    return this.props.rootCause;
  }
  get relation(): CiFindingRelation {
    return this.props.relation;
  }
  get flake(): CiFindingFlake {
    return this.props.flake;
  }
  get action(): CiFindingAction {
    return this.props.action;
  }
  get next(): string {
    return this.props.next;
  }
  get confidence(): CiFindingConfidence {
    return this.props.confidence;
  }
  get evidence(): readonly string[] {
    return this.props.evidence;
  }
  get recordedByUserId(): string | null {
    return this.props.recordedByUserId;
  }
  get recordedByBotId(): string | null {
    return this.props.recordedByBotId;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.headSha || !props.check || !props.rootCause) {
      throw new ArgumentNotProvidedException('A finding names its check, commit and cause');
    }
    if (!Number.isInteger(props.number) || props.number < 1) {
      throw new ArgumentInvalidException('A pull request has a positive number');
    }
    if (props.evidence.length === 0 || props.evidence.some((item) => !item)) {
      throw new ArgumentNotProvidedException('A finding rests on some evidence');
    }
  }
}
