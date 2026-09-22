/**
 * Whether *this tab* is still walking the first-run flow.
 *
 * Onboarding is shown once (`05-screens.md`), and the test for "this account
 * is finished" is the workspace address: provisional means sign-up minted it,
 * chosen means a person claimed it (`08-auth.md`). That test cannot gate the
 * walk on its own, because two of the four steps run *after* the claim — an
 * account is finished the moment it names its workspace, with Connect GitHub
 * and Add host still in front of it. Gating on the claim alone would throw
 * every new account into the console from step 2.
 *
 * So the gate over `/onboarding` reads two things: whether the account is
 * finished, which the API answers, and whether this tab is mid-walk, which is
 * what this file remembers. The walk opens when step 2 submits its claim and
 * closes when Ready hands the reader to the console; between those, it is the
 * only reason a finished account is allowed under `/onboarding` at all.
 *
 * `sessionStorage`, deliberately. A walk belongs to one tab and one visit: it
 * has to survive a reload in the middle of step 4, which React state would
 * not, and it must not follow the reader into next week, which `localStorage`
 * would. A second tab opened on `/onboarding/host` is not the walk — it is
 * someone typing the URL, which is exactly what the gate is for.
 *
 * Every access is wrapped, and an unreadable store reads as *walking*: a
 * browser with site data switched off throws on the property itself, and of
 * the two ways to be wrong here — letting a finished reader see a step again,
 * or bouncing a reader out of the flow they are halfway through, with no
 * second chance to pair a host — only the first is recoverable.
 */
const KEY = 'oppenheimer.first-run';

/** Step 2 is submitting: from here to Ready, this tab is walking. */
export function openFirstRun(): void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage is off. `isWalkingFirstRun` fails open, so the flow still walks.
  }
}

/** The reader has left for the console, or for another account. The walk is over. */
export function closeFirstRun(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was written in the first place.
  }
}

/** Is this tab between step 2's claim and Ready? */
export function isWalkingFirstRun(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}
