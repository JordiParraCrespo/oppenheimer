/**
 * What the Oppenheimer API said when it refused: its status and the problem's
 * title (RFC 7807), or the status text when the body is not one. Every call
 * the extension makes words a refusal this way, so the popup says the same
 * thing for the same answer.
 */
export async function apiError(response: Response): Promise<Error> {
  const problem = (await response.json().catch(() => null)) as { title?: string } | null;
  return new Error(`${response.status} ${problem?.title ?? response.statusText}`.trim());
}
