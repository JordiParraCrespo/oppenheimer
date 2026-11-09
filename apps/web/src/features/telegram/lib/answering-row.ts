/**
 * What the "Answers you" row says and offers, from where the owner link
 * stands: its line under the title, and the button that makes a link (its
 * label and how loud it is). A link just made is the next step, so its own
 * Open the link button leads and this one only makes another.
 */
export function answeringRowState(state: { ownerLinked: boolean; linkMade: boolean }) {
  if (state.linkMade) {
    return {
      meta: 'settings.telegram.answering.linkReady',
      linkLabel: 'settings.telegram.answering.newLink',
      linkVariant: 'ghost',
    } as const;
  }
  if (state.ownerLinked) {
    return {
      meta: 'settings.telegram.answering.linked',
      linkLabel: 'settings.telegram.answering.linkAgain',
      linkVariant: 'ghost',
    } as const;
  }
  return {
    meta: 'settings.telegram.answering.notLinked',
    linkLabel: 'settings.telegram.answering.link',
    linkVariant: 'secondary',
  } as const;
}
