import { PersonRow } from './person-row';

/** The rail's Comments before the conversation answers: a commenter's row, twice. */
export function CommentersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <PersonRow />
      <PersonRow />
    </div>
  );
}
