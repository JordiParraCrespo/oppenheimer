---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/shared": patch
---

Settings → WhatsApp says who answers on a connected number
(`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3).

- `@oppenheimer/web`: under each connected number, "Answers you" picks the
  bot that answers by default, or none, and "Your number" names the
  reader's own number, sends it a code from the linked one, and takes the
  code back, with Send a new code, Use another number and, once confirmed,
  Change. An expired code offers a new one, and an offline host sends none.
- `@oppenheimer/frontend-consumer`: `WhatsappAccountEntity` carries
  `answeringBotId`, `ownerNumber`, `ownerPendingNumber`,
  `ownerCodeExpiresAt`, `ownerState` and `codeExpired(now)`;
  `WhatsappRepository` gains `answerAs`, `requestOwner` and `confirmOwner`,
  with the hooks `useAnswerWhatsappAs`, `useRequestWhatsappOwner` and
  `useConfirmWhatsappOwner`; `useSuspenseWhatsappSettings` also reads the
  reader's bots.
- `@oppenheimer/translations`: `settings.whatsapp.answering.*` and
  `settings.whatsapp.owner.*`, in English and Spanish.
- `@oppenheimer/shared`: `requestWhatsappOwnerSchema` and
  `confirmWhatsappOwnerSchema` no longer state English messages, so the
  console's forms say a wrong format in the reader's language.
