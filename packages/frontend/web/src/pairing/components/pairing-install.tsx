import {
  Button,
  CodeBlock,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { Bot, Copy } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCopied } from '../hooks/use-copied';

/** The two ways to read one instruction, and the key each reads its label by. */
const FORMATS = ['command', 'agentPrompt'] as const;
type PairingFormat = (typeof FORMATS)[number];

const isFormat = (value: string): value is PairingFormat =>
  (FORMATS as readonly string[]).includes(value);

/**
 * The instruction a host is paired with, both ways to read it. Structural,
 * as the API answers it: the install command, and the prompt for an agent
 * already running on the machine. Both carry the token; neither is
 * assembled on this side.
 */
export interface PairingCommands {
  installCommand: string;
  agentPrompt: string;
  installScriptSha256?: string | null;
}

/**
 * The way in (`design/version1/AddHost.dc.html`, `SessionsConsole.dc.html`):
 * a person copies the instruction rather than reading it. Two buttons —
 * Copy install command, the secondary, and Copy agent prompt, ghost — each
 * reading Copied for a moment after it is pressed. `size` is the surface's:
 * the onboarding step draws them large, the console's dialog at the medium
 * height.
 */
export function PairingCopyButtons({
  pairing,
  size = 'md',
}: {
  /** Absent while the token is being minted; the buttons wait, disabled. */
  pairing: PairingCommands | null;
  size?: 'md' | 'lg';
}) {
  const { t } = useTranslation();
  const { copied, copy } = useCopied();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={!pairing}
        onClick={() => pairing && copy('command', pairing.installCommand)}
      >
        <Copy />
        {copied === 'command' ? t('common.copied') : t('hosts.pairing.copyCommand')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={size}
        disabled={!pairing}
        onClick={() => pairing && copy('agentPrompt', pairing.agentPrompt)}
      >
        <Bot />
        {copied === 'agentPrompt' ? t('common.copied') : t('hosts.pairing.copyPrompt')}
      </Button>
    </div>
  );
}

/**
 * The instruction itself, the one place it is drawn: a `CodeBlock` panel
 * with the Command / Agent prompt tabs on its band, the installer's digest
 * under the command form when the deployment published one.
 *
 * `layout="panel"` shows it outright, which is Settings' Install step
 * (`design/version1/Settings.dc.html`). `layout="fold"` puts it behind
 * "Inspect command and prompt", closed by default, which is the onboarding
 * step and the console's dialog: there the copy buttons are the way in and
 * the text is for the person who wants to see it first.
 */
export function PairingInstruction({
  pairing,
  layout = 'fold',
}: {
  pairing: PairingCommands | null;
  layout?: 'panel' | 'fold';
}) {
  const { t } = useTranslation();
  // Which way the same instruction is being read. This is the lowest
  // component that reads it, and the switch changes nothing else on screen.
  const [format, setFormat] = useState<PairingFormat>('command');

  const panel = pairing ? (
    <CodeBlock
      layout="panel"
      tabs={FORMATS.map((option) => ({
        value: option,
        label: t(`hosts.pairing.${option}` as const),
      }))}
      tab={format}
      onTabChange={(next) => {
        // The block speaks strings; the guard is what keeps that at the
        // boundary instead of casting it away.
        if (isFormat(next)) setFormat(next);
      }}
      tabsLabel={t('hosts.pairing.format')}
      code={format === 'command' ? pairing.installCommand : pairing.agentPrompt}
      note={
        format === 'command' && pairing.installScriptSha256
          ? t('hosts.pairing.installerDigest', { digest: pairing.installScriptSha256 })
          : undefined
      }
      copyLabel={t('common.copy')}
      copiedLabel={t('common.copied')}
    />
  ) : (
    <Skeleton className="h-48 w-full" />
  );

  if (layout === 'panel') return panel;

  return (
    <Disclosure>
      <DisclosureTrigger tone="muted">{t('hosts.pairing.inspect')}</DisclosureTrigger>
      <DisclosurePanel className="mt-2.5">{panel}</DisclosurePanel>
    </Disclosure>
  );
}
