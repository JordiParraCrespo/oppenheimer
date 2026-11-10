import { createHash, randomInt } from 'node:crypto';
import {
  WHATSAPP_OWNER_CODE_ATTEMPTS_MAX,
  WHATSAPP_OWNER_CODE_TTL_MINUTES,
} from '@oppenheimer/shared';

/** How long the code sent to the owner's number can be entered. */
export const WHATSAPP_OWNER_CODE_TTL_MS = WHATSAPP_OWNER_CODE_TTL_MINUTES * 60_000;

/** Wrong codes entered before the waiting one is locked and a new one is needed. */
export const WHATSAPP_OWNER_CODE_ATTEMPTS = WHATSAPP_OWNER_CODE_ATTEMPTS_MAX;

/** Six digits, from the system's random source, leading zeros kept. */
export function generateWhatsappOwnerCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** The code as stored: never the code itself. */
export function hashWhatsappOwnerCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

/** A phone number's JID (`<digits>@s.whatsapp.net`): the only kind of chat an owner writes from. */
const PHONE_JID = /^(\d{7,15})@s\.whatsapp\.net$/;

/** `34600111222@s.whatsapp.net` → `+34600111222`; anything that is not a phone JID is null. */
export function whatsappNumberOf(jid: string | null): string | null {
  const match = PHONE_JID.exec(jid ?? '');
  return match ? `+${match[1]}` : null;
}

/** Whether a JID names a phone number (not a group, not an `@lid`). */
export function isWhatsappPhoneJid(jid: string): boolean {
  return PHONE_JID.test(jid);
}

/** The line that carries the code to the number being named; with no code, as it is kept, masked. */
export function whatsappOwnerCodeLine(code: string | null): string {
  return `Your Oppenheimer code is ${code ?? '••••••'}. Enter it in Settings → WhatsApp. It expires in ${WHATSAPP_OWNER_CODE_TTL_MINUTES} minutes.`;
}
