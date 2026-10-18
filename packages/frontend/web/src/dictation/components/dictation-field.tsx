import { DictationFrame, type DictationSlot } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { type Dictation, useDictation, type VoiceInput } from '../hooks/use-dictation';
import { DictationBar } from './dictation-bar';
import { DictationError } from './dictation-error';
import { DictationMic } from './dictation-mic';

/**
 * Dictation as every host takes it (`DictationSlot`): the mic while anyone
 * can hear this workspace, the recorder while recording or transcribing,
 * and what went wrong last. `Composer`, `ChatComposer`, `DiffCommentDraft`
 * and `ReviewDecision` take it as `dictation`; `DictationField` gives a
 * plain field one.
 */
export function dictationSlots(dictation: Dictation): DictationSlot {
  return {
    mic: dictation.available ? (
      <DictationMic recording={dictation.recording} onClick={dictation.toggle} />
    ) : undefined,
    recorder: dictation.phase ? <DictationBar dictation={dictation} /> : undefined,
    notice: dictation.problem ? <DictationError problem={dictation.problem} /> : undefined,
  };
}

/**
 * A plain multi-line field that takes dictation (`product/next-steps/voice.md`):
 * the field as its child, framed with the slot. What is heard goes to
 * `onText`, which adds it to the field (`dictateInto`, `dictateIntoField`).
 */
export function DictationField({
  voice,
  onText,
  children,
  className,
}: {
  voice: VoiceInput;
  onText: (text: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const dictation = useDictation({ voice, onText });
  return (
    <DictationFrame className={className} dictation={dictationSlots(dictation)}>
      {children}
    </DictationFrame>
  );
}
