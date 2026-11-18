import { type FileTreeIconConfig, getBuiltInSpriteSheet, type RemappedIcon } from '@pierre/trees';

import VENDOR_MARKS from './file-icon-marks.json';

/**
 * The file-type marks `FileIcon` and `DiffFileTree` draw: @pierre/trees'
 * `complete` set, corrected and widened.
 *
 * - The set draws HTML as a `#`, which reads as CSS; markup is `</>` on the
 *   set's rounded tile instead (HTML in its orange, XML and the template
 *   languages in neutral ink).
 * - A file the set leaves on its blank page but that belongs to a mark it
 *   has takes that mark: `go.mod` is Go, `Cargo.toml` Rust, `.hcl`
 *   Terraform, a certificate the lock.
 * - A language the set has no mark for wears its vendor's own, as Simple
 *   Icons publishes it (`file-icon-marks.json`): Java, Kotlin, PHP, Haskell,
 *   Lua, Dart, Elixir… A PDF is a page in red; anything left is the code
 *   page, a page with `<>` on it, in neutral ink. Never a redrawn logo.
 *
 * Every rule names its icon and the token whose `--file-icon-<token>` hue
 * it wears; the tree reads the token off the resolved icon, so a remapped
 * mark keeps its colour there too. The tree colours only the set's own
 * tokens, so the ones added here come with their rules
 * (`FILE_ICON_TREE_CSS`); `FileIcon` reads the same map by token.
 */

/**
 * The vendors' own marks for the languages the set has none for, as Simple
 * Icons publishes them (24×24, one path each), copied verbatim into
 * `file-icon-marks.json` with each mark's source file and the licence the
 * package lists for it. Java is OpenJDK's mark (Oracle's is not published
 * there) and a Makefile is GNU's (Make has none of its own). The next mark
 * is a line of that file and a rule below; a mark is never redrawn.
 */
type VendorMark = keyof typeof VENDOR_MARKS;

const MARKUP = 'op-file-icon-markup';
const CODE = 'op-file-icon-code';
const PDF = 'op-file-icon-pdf';
const vendorId = (mark: VendorMark) => `op-file-icon-${mark}`;

const TILE = '<path fill="currentColor" d="M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7" opacity=".2"/>';
const PAGE =
  '<path fill="currentColor" fill-rule="evenodd" d="M8 4a3 3 0 0 0 3 3h3v5.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1H8z" clip-rule="evenodd" opacity=".4"/><path fill="currentColor" d="M9.5 1a.5.5 0 0 1 .354.146l4 4A.5.5 0 0 1 14 5.5V6h-3a2 2 0 0 1-2-2V1z"/>';
const STROKE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25"';

/** The symbols this file adds: the markup, code and PDF marks and the vendors'. */
const SYMBOLS = [
  `<symbol id="${MARKUP}" viewBox="0 0 16 16">${TILE}<path ${STROKE} d="M5.75 5.25 3.25 8l2.5 2.75m4.5-5.5L12.75 8l-2.5 2.75M8.9 4.5l-1.8 7"/></symbol>`,
  `<symbol id="${CODE}" viewBox="0 0 16 16">${PAGE}<path ${STROKE} d="M6.25 8.75 4.75 10.5l1.5 1.75m3.5-3.5 1.5 1.75-1.5 1.75"/></symbol>`,
  `<symbol id="${PDF}" viewBox="0 0 16 16">${PAGE}<path fill="currentColor" d="M8.5 11a.5.5 0 0 1 0 1h-3a.5.5 0 0 1 0-1zm2-2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1z"/></symbol>`,
  // The vendors' 24px marks, inset to sit at the set's 14px inside 16.
  ...Object.entries(VENDOR_MARKS).map(
    ([mark, { path }]) =>
      `<symbol id="${vendorId(mark as VendorMark)}" viewBox="-1.7 -1.7 27.4 27.4"><path fill="currentColor" d="${path}"/></symbol>`,
  ),
].join('');

const builtIn = (token: string) => ({ name: `file-tree-builtin-${token}`, token });
/** The set's types, by token: a rule pointing a file at one of them. */
const as = (token: string) => builtIn(token) as RemappedIcon;
const markup = (token: 'html' | 'default') => ({ name: MARKUP, token }) as RemappedIcon;
const code = { name: CODE, token: 'default' } as RemappedIcon;
const lock = { name: 'file-tree-icon-lock', token: 'default' } as RemappedIcon;
/** A vendor's mark, in the hue of the token of the same name. */
const vendor = (mark: VendorMark) => ({ name: vendorId(mark), token: mark }) as RemappedIcon;

/** The tokens this file adds to the set's, each a `--file-icon-<token>` in `globals.css`. */
const EXTRA_TOKENS = [...(Object.keys(VENDOR_MARKS) as VendorMark[]), 'pdf'];

/** The tree's rules for those tokens: their hues, from the same map as the set's. */
const FILE_ICON_TREE_CSS = EXTRA_TOKENS.map((token) => `[data-icon-token="${token}"]{color:var(--file-icon-${token})}`).join('');

/** The whole sheet `FileIcon` adds to the document: the set's symbols and these. */
function fileIconSprite() {
  const sheet = getBuiltInSpriteSheet('complete');
  const end = sheet.lastIndexOf('</svg>');
  return `${sheet.slice(0, end)}${SYMBOLS}${sheet.slice(end)}`;
}

const each = <T>(keys: string, icon: T) => Object.fromEntries(keys.split(' ').map((key) => [key, icon]));

const FILE_ICON_SET = {
  set: 'complete',
  colored: true,
  spriteSheet: `<svg xmlns="http://www.w3.org/2000/svg">${SYMBOLS}</svg>`,
  byFileName: {
    ...each('go.mod go.sum', as('go')),
    ...each('cargo.toml cargo.lock', as('rust')),
    ...each('pyproject.toml pipfile pipfile.lock poetry.lock uv.lock setup.cfg .python-version', as('python')),
    ...each('gemfile.lock .ruby-version', as('ruby')),
    ...each('containerfile .dockerignore', as('docker')),
    ...each('makefile gnumakefile', vendor('gnu')),
    ...each('cmakelists.txt', vendor('cmake')),
    ...each('justfile', code),
    ...each('license licence copying notice', as('text')),
  },
  byFileExtension: {
    ...each('html htm xhtml', markup('html')),
    ...each(
      'xml plist xsd xsl xslt hbs handlebars mustache ejs pug jade njk nunjucks jinja jinja2 j2 twig liquid blade.php',
      markup('default'),
    ),
    ...each('java jar class jsp', vendor('java')),
    ...each('kt kts', vendor('kotlin')),
    ...each('scala sc sbt', vendor('scala')),
    ...each('gradle', vendor('gradle')),
    ...each('cs csx csproj sln razor cshtml vb vbproj', vendor('dotnet')),
    ...each('fs fsx fsi fsproj', vendor('fsharp')),
    ...each('php phtml', vendor('php')),
    ...each('lua', vendor('lua')),
    ...each('dart', vendor('dart')),
    ...each('ex exs heex eex leex', vendor('elixir')),
    ...each('erl hrl', vendor('erlang')),
    ...each('hs lhs cabal', vendor('haskell')),
    ...each('ml mli', vendor('ocaml')),
    ...each('clj cljs cljc edn', vendor('clojure')),
    ...each('r rmd', vendor('r')),
    ...each('jl', vendor('julia')),
    ...each('pl pm', vendor('perl')),
    ...each('nim nimble', vendor('nim')),
    ...each('cr', vendor('crystal')),
    ...each('sol', vendor('solidity')),
    ...each('elm', vendor('elm')),
    ...each('purs', vendor('purescript')),
    ...each('gleam', vendor('gleam')),
    ...each('vim', vendor('vim')),
    ...each('nix', vendor('nix')),
    ...each('ipynb', vendor('jupyter')),
    ...each('mk', vendor('gnu')),
    ...each('cmake', vendor('cmake')),
    ...each('pdf', { name: PDF, token: 'pdf' } as RemappedIcon),
    ...each('groovy gvy odin tcl asm s m mm proto v', code),
    ...each('ps1 psm1 psd1 bat cmd', as('bash')),
    ...each('hcl tfvars', as('terraform')),
    ...each('dockerfile containerfile', as('docker')),
    ...each('diff patch', as('git')),
    ...each('pem key crt cer csr der p12 pfx pub gpg asc', lock),
    ...each('toml lock doc docx rtf odt rst adoc org http rest vtt srt', as('text')),
    ...each('lockb', as('bun')),
    ...each('cjsx', as('react')),
    ...each('markdown mdown mkd mdc', as('markdown')),
    ...each('avif bmp tif tiff heic heif', as('image')),
    ...each('7z rar bz2 xz tgz zst', as('zip')),
    ...each('otf woff eot', as('font')),
  },
} satisfies FileTreeIconConfig;

export { FILE_ICON_SET, FILE_ICON_TREE_CSS, fileIconSprite };
