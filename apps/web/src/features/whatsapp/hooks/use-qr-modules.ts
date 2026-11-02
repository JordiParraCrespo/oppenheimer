import { useEffect, useState } from 'react';
import { encodeQr } from '@/features/whatsapp/lib/qr-encoder';

type Modules = readonly (readonly boolean[])[];

/**
 * A QR code's modules for `text`. The effect synchronises with the encoder's
 * lazy load (`encodeQr`); null until it has answered for this text.
 */
export function useQrModules(text: string | null): Modules | null {
  const [encoded, setEncoded] = useState<{ text: string; modules: Modules } | null>(null);
  useEffect(() => {
    if (!text) return;
    let live = true;
    void encodeQr(text).then((modules) => {
      if (live) setEncoded({ text, modules });
    });
    return () => {
      live = false;
    };
  }, [text]);
  return encoded && encoded.text === text ? encoded.modules : null;
}
