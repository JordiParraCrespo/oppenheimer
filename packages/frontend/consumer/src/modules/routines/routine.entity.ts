/**
 * What starts a routine: a schedule the control plane keeps, or an event
 * GitHub sends. The 2026-09-26 export's two glyphs — a clock, the GitHub
 * mark (`product/versions/mvp/13-automations.md`).
 */
export type RoutineTrigger = 'schedule' | 'github';

/** Whether the routine's triggers are honoured right now. */
export type RoutineState = 'active' | 'paused';

/**
 * A routine — an automation, in the console's copy: a session the control
 * plane starts on a schedule or on a GitHub event, in a project, on a host,
 * with an agent. The shape the console's automations pages are built
 * against; the API behind it is note 13's next slice, so no repository or
 * service reads it yet.
 */
export class RoutineEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly projectId: string,
    public readonly trigger: RoutineTrigger,
    public readonly state: RoutineState,
    /** When the schedule fires next; null for an event trigger or a paused routine. */
    public readonly nextRunAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  get isPaused(): boolean {
    return this.state === 'paused';
  }
}
