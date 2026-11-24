/** The theme tokens a visual's HTML may style itself with, under the names the frame's page reads. */
const TOKENS: Record<string, string> = {
  '--background': '--background',
  '--card': '--card',
  '--fg': '--fg',
  '--fg-muted': '--fg-muted',
  '--fg-subtle': '--fg-subtle',
  '--border': '--border-subtle',
  '--border-strong': '--border',
  '--hover': '--hover-surface',
  '--primary': '--primary',
  '--link': '--link',
  '--success': '--success',
  '--warning': '--warning',
  '--danger': '--danger',
  '--chart-1': '--chart-1',
  '--chart-2': '--chart-2',
  '--chart-3': '--chart-3',
  '--chart-4': '--chart-4',
  '--chart-5': '--chart-5',
  '--font-sans': '--font-sans',
  '--font-mono': '--font-mono',
};

/**
 * The console's theme as the frame takes it: each token's resolved value
 * (a colour, a font stack), never a `var()` the frame could not resolve, and
 * whether the theme is dark.
 */
export function visualTheme(): { variables: Record<string, string>; dark: boolean } {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const variables: Record<string, string> = {};
  for (const [name, source] of Object.entries(TOKENS)) {
    const value = style.getPropertyValue(source).trim();
    if (value) variables[name] = value;
  }
  const dark = root.classList.contains('dark') || root.dataset.theme === 'dark';
  return { variables, dark };
}
