/**
 * What another module may read about a host's last reported state before it
 * asks the host for work — the read side of presence, kept apart from the
 * port the runner link writes through.
 */
export interface HostVitalsPort {
  /** The free disk the host last reported, in bytes; `null` when it never has. */
  lastFreeDisk(hostId: string): Promise<number | null>;
}
