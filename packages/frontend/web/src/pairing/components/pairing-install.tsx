import { CodeBlock, Skeleton } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
 * The instruction itself, outright: a `CodeBlock` panel with the Command /
 * Agent prompt tabs on its band, the installer's digest under the command
 * form when the deployment published one. Settings' Install step
 * (`design/version1/Settings.dc.html`); the onboarding step and the console's
 * dialog lead with the prompt instead (`PairingChrome`).
 */
export function PairingInstruction({ pairing }: { pairing: PairingCommands | null }) {
  const { t } = useTranslation();
  // Which way the same instruction is being read. This is the lowest
  // component that reads it, and the switch changes nothing else on screen.
  const [format, setFormat] = useState<PairingFormat>('command');

  return pairing ? (
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
}
