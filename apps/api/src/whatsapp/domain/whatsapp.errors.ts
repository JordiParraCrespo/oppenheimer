import type { ErrorDefinition } from '@oppenheimer/backend-ddd';

export const WhatsappErrors = {
  /** No such linked number of the caller's. */
  ACCOUNT_NOT_FOUND: {
    code: 'WHATSAPP_001',
    message: 'That WhatsApp number is not linked',
    httpStatus: 404,
  },
  NO_ACTIVE_ORGANIZATION: {
    code: 'WHATSAPP_002',
    message: 'WhatsApp belongs to an organization',
    httpStatus: 400,
  },
  /** The person already links as many numbers as they may; unlink one first. */
  ACCOUNT_LIMIT_REACHED: {
    code: 'WHATSAPP_003',
    message: 'That is as many WhatsApp numbers as one person links',
    httpStatus: 409,
  },
  /** The host's runner is not connected, so nothing can reach its device. */
  HOST_OFFLINE: {
    code: 'WHATSAPP_004',
    message: 'The host holding that WhatsApp number is offline',
    httpStatus: 409,
  },
  /** The host's runner predates WhatsApp, or was started with it switched off. */
  HOST_UNSUPPORTED: {
    code: 'WHATSAPP_005',
    message: 'That host’s runner does not hold WhatsApp devices',
    httpStatus: 409,
  },
  /** Another person's number is linked on that host: a runner holds one device. */
  HOST_TAKEN: {
    code: 'WHATSAPP_006',
    message: 'That host already holds another WhatsApp number',
    httpStatus: 409,
  },
  /** The device is not connected to WhatsApp: pairing, logged out, or reconnecting. */
  NOT_CONNECTED: {
    code: 'WHATSAPP_007',
    message: 'That WhatsApp number is not connected',
    httpStatus: 409,
  },
  /** WhatsApp, or the host's runner, refused the message or did not answer. */
  SEND_FAILED: {
    code: 'WHATSAPP_008',
    message: 'WhatsApp did not take the message',
    httpStatus: 502,
  },
  /** The number has sent its day's share of bot messages, or the host's own budget is spent. */
  SEND_LIMIT_REACHED: {
    code: 'WHATSAPP_009',
    message: 'That number has sent as many bot messages as it may for now',
    httpStatus: 429,
  },
  /** No chat on that number matches, or several do. */
  CHAT_NOT_FOUND: {
    code: 'WHATSAPP_010',
    message: 'No such WhatsApp chat',
    httpStatus: 404,
  },
  /** The code entered is not the one the owner's number received, or it expired. */
  OWNER_CODE_INVALID: {
    code: 'WHATSAPP_011',
    message: 'That code is wrong or has expired',
    httpStatus: 422,
  },
  /** No number is waiting for its code: name your number first. */
  OWNER_CODE_NONE: {
    code: 'WHATSAPP_012',
    message: 'No number is waiting to be confirmed',
    httpStatus: 409,
  },
  /** Not a phone number, or the linked number itself: the owner writes from another. */
  OWNER_NUMBER_INVALID: {
    code: 'WHATSAPP_013',
    message: 'That number cannot be your own number here',
    httpStatus: 422,
  },
  /** Too many wrong codes for the waiting one: ask for a new code. */
  OWNER_CODE_LOCKED: {
    code: 'WHATSAPP_014',
    message: 'Too many wrong codes',
    httpStatus: 429,
  },
} as const satisfies Record<string, ErrorDefinition>;
