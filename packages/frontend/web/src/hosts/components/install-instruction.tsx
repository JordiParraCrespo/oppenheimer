import { CodeBlock, Skeleton } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The instruction a pairing token comes with, as the API composed it. Structural
 * rather than the product's pairing entity: the kit imports no product package,
 * and these three fields are all the panel reads.
 */
export interface PairingInstruction {
  installCommand: string;
  agentPrompt: string;
  installScriptSha256: string | null;
}

/** The two ways to read one instruction, and the key each reads its label by. */
const FORMATS = ['command', 'agentPrompt'] as const;
type Format = (typeof FORMATS)[number];

const isFormat = (value: string): value is Format => (FORMATS as readonly string[]).includes(value);

/**
 * The install instruction in its two forms: one `CodeBlock` panel with the
 * Command / Agent prompt pills in its band beside Copy, and the installer's
 * digest under the command.
 *
 * Shared because two surfaces show exactly this — Settings' Add a host page,
 * under its Install step, and the console's Add a host dialog, behind its
 * "Inspect command and prompt" (`design/version1/Settings.dc.html`,
 * `…/SessionsConsole.dc.html`) — and a feature may not import another
 * feature. Which form is showing is this panel's own state: the switch
 * changes nothing else on either surface.
 *
 * Both strings come from the API with the secret already in them: it is shown
 * once, the server is the only place that knows it, so neither is assembled
 * here. Until the token is minted the panel holds its place with a skeleton.
 */
export function HostInstallInstruction({
  instruction,
}: {
  instruction: PairingInstruction | null | undefined;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<Format>('command');

  if (!instruction) return <Skeleton className="h-48 w-full" />;

  return (
    <CodeBlock
      layout="panel"
      tabs={FORMATS.map((option) => ({
        value: option,
        label: t(`hosts.add.install.${option}` as const),
      }))}
      tab={format}
      onTabChange={(next) => {
        // The block speaks strings; the guard keeps that at the boundary
        // instead of casting it away.
        if (isFormat(next)) setFormat(next);
      }}
      tabsLabel={t('hosts.add.install.format')}
      code={format === 'command' ? instruction.installCommand : instruction.agentPrompt}
      note={
        format === 'command' && instruction.installScriptSha256
          ? t('hosts.pairing.installerDigest', { digest: instruction.installScriptSha256 })
          : undefined
      }
      copyLabel={t('common.copy')}
      copiedLabel={t('common.copied')}
    />
  );
}
