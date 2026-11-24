import { labelOfEngine } from './engine-label';

/** A session's title line: the engine and the model. */
export function engineTitle(engine: string, model: string): string {
  return `${labelOfEngine(engine)} · ${model}`;
}
