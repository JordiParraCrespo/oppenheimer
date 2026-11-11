/**
 * Whether two WhatsApp addresses are the same person's number. In two
 * countries WhatsApp keeps some numbers in a form other than the one people
 * type: Brazil's mobiles registered before the ninth digit came in keep
 * their old eight digits (55 11 9xxxx-xxxx is 55 11 xxxx-xxxx), and Mexico's
 * mobiles may carry, or lack, the 1 after 52. Each pair counts as one number,
 * so an owner who typed either form is still the owner.
 */
export function sameWhatsappNumber(a: string, b: string): boolean {
  return a === b || canonicalNumber(a) === canonicalNumber(b);
}

function canonicalNumber(address: string): string {
  const [user = '', server = ''] = address.split('@');
  if (server !== 's.whatsapp.net') return address;
  const digits = user.split(':')[0] ?? '';
  const brazil = /^55(\d{2})9(\d{8})$/.exec(digits);
  if (brazil) return `55${brazil[1]}${brazil[2]}`;
  const mexico = /^521(\d{10})$/.exec(digits);
  if (mexico) return `52${mexico[1]}`;
  return digits;
}
