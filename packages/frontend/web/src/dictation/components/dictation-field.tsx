import { DictationFrame } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { type Dictation, useDictation, type VoiceInput } from '../hooks/use-dictation';
import { DictationBar } from './dictation-bar';
import { DictationError } from './dictation-error';
import { DictationMic } from './dictation-mic';

/**
 * A plain multi-line field that takes dictation (`product/next-steps/voice.md`):
 * the field as its child, the mic in its corner while `voice` says anyone can
 * hear this workspace, the recorder under it while dictating, and what went
 * wrong under it after. What is heard goes to `onText`; the field adds it to
 * what it holds (`appendDictation`), so a form field stays its form's.
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
    <DictationFrame className={className} {...dictationSlots(dictation)}>
      {children}
    </DictationFrame>
  );
}

/**
 * A field's mic and recorder, for a design-system component that frames its
 * own field (`DiffCommentDraft`, `ReviewDecision`) and takes them as its
 * `dictation`.
 */
export function dictationSlots(dictation: Dictation): { mic?: ReactNode; recorder: ReactNode } {
  return {
    mic: dictation.available ? (
      <DictationMic recording={dictation.recording} onClick={dictation.toggle} />
    ) : undefined,
    recorder: <DictationParts dictation={dictation} />,
  };
}

/** The bar while dictating, else what went wrong, else nothing. */
function DictationParts({ dictation }: { dictation: Dictation }) {
  if (dictation.phase) return <DictationBar dictation={dictation} />;
  return <DictationError problem={dictation.problem} />;
}
