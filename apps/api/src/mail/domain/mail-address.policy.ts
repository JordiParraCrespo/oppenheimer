/**
 * Mail addresses as headers write them (`Ana Díaz <ana@acme.test>, "Ruiz, Bo"
 * <bo@x.test>`), read into a name and an address. The address is what a
 * recipient is compared by; the whole is what a header carries.
 */
export interface MailAddress {
  name: string | null;
  email: string;
}

const ADDRESS = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

/** Whether `email` is one plain address, the only shape a recipient may take. */
export function isMailAddress(email: string): boolean {
  return ADDRESS.test(email.trim());
}

/** Every address in a header, in order; a part with no address in it is dropped. */
export function addressesOf(header: string): MailAddress[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  let angled = false;
  for (const char of header) {
    if (char === '"') quoted = !quoted;
    else if (char === '<' && !quoted) angled = true;
    else if (char === '>' && !quoted) angled = false;
    if ((char === ',' || char === ';') && !quoted && !angled) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  const found: MailAddress[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const angle = /^(.*)<([^<>]+)>\s*$/.exec(trimmed);
    const email = (angle ? angle[2] : trimmed).trim();
    if (!isMailAddress(email)) continue;
    const name = angle
      ? angle[1]
          .trim()
          .replace(/^"(.*)"$/, '$1')
          .trim()
      : '';
    found.push({ name: name || null, email });
  }
  return found;
}

/** The address as a header writes it: the name quoted when it needs to be. */
export function formatAddress({ name, email }: MailAddress): string {
  if (!name) return email;
  return /[",;<>@()]/.test(name)
    ? `"${name.replace(/"/g, '\\"')}" <${email}>`
    : `${name} <${email}>`;
}

/** Recipients with no repeats, compared by address and ignoring case; the first spelling is kept. */
export function uniqueAddresses(addresses: readonly MailAddress[]): MailAddress[] {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = address.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
