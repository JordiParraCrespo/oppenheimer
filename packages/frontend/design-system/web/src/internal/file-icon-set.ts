import type { FileTreeIconConfig, RemappedIcon } from '@pierre/trees';

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
 * - Source in a language with no published mark here is the code page, a
 *   page with `<>` on it, in neutral ink. Never a redrawn vendor logo.
 *
 * Every rule names its icon and the token whose `--file-icon-<token>` hue
 * it wears; the tree reads the token off the resolved icon, so a remapped
 * mark keeps its colour there too.
 */

const MARKUP = 'op-file-icon-markup';
const CODE = 'op-file-icon-code';

const TILE = '<path fill="currentColor" d="M8 1C2.24 1 1 2.24 1 8s1.24 7 7 7 7-1.24 7-7-1.24-7-7-7" opacity=".2"/>';
const PAGE =
  '<path fill="currentColor" fill-rule="evenodd" d="M8 4a3 3 0 0 0 3 3h3v5.5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1H8z" clip-rule="evenodd" opacity=".4"/><path fill="currentColor" d="M9.5 1a.5.5 0 0 1 .354.146l4 4A.5.5 0 0 1 14 5.5V6h-3a2 2 0 0 1-2-2V1z"/>';
const STROKE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.25"';

const SPRITE = [
  '<svg xmlns="http://www.w3.org/2000/svg">',
  `<symbol id="${MARKUP}" viewBox="0 0 16 16">${TILE}<path ${STROKE} d="M5.75 5.25 3.25 8l2.5 2.75m4.5-5.5L12.75 8l-2.5 2.75M8.9 4.5l-1.8 7"/></symbol>`,
  `<symbol id="${CODE}" viewBox="0 0 16 16">${PAGE}<path ${STROKE} d="M6.25 8.75 4.75 10.5l1.5 1.75m3.5-3.5 1.5 1.75-1.5 1.75"/></symbol>`,
  '</svg>',
].join('');

const builtIn = (token: string) => ({ name: `file-tree-builtin-${token}`, token });
/** The set's types, by token: a rule pointing a file at one of them. */
const as = (token: string) => builtIn(token) as RemappedIcon;
const markup = (token: 'html' | 'default') => ({ name: MARKUP, token }) as RemappedIcon;
const code = { name: CODE, token: 'default' } as RemappedIcon;
const lock = { name: 'file-tree-icon-lock', token: 'default' } as RemappedIcon;

const each = <T>(keys: string, icon: T) => Object.fromEntries(keys.split(' ').map((key) => [key, icon]));

const FILE_ICON_SET = {
  set: 'complete',
  colored: true,
  spriteSheet: SPRITE,
  byFileName: {
    ...each('go.mod go.sum', as('go')),
    ...each('cargo.toml cargo.lock', as('rust')),
    ...each('pyproject.toml pipfile pipfile.lock poetry.lock uv.lock setup.cfg .python-version', as('python')),
    ...each('gemfile.lock .ruby-version', as('ruby')),
    ...each('containerfile .dockerignore', as('docker')),
    ...each('makefile gnumakefile justfile', code),
    ...each('license licence copying notice', as('text')),
  },
  byFileExtension: {
    ...each('html htm xhtml', markup('html')),
    ...each(
      'xml plist xsd xsl xslt hbs handlebars mustache ejs pug jade njk nunjucks jinja jinja2 j2 twig liquid blade.php',
      markup('default'),
    ),
    ...each(
      'java kt kts scala sc groovy gradle cs csx fs fsx vb php lua dart ex exs erl hrl hs lhs ml mli clj cljs cljc edn r jl pl pm nim cr sol elm purs gleam odin tcl asm s m mm vim nix proto mk',
      code,
    ),
    ...each('ps1 psm1 psd1 bat cmd', as('bash')),
    ...each('hcl tfvars', as('terraform')),
    ...each('dockerfile containerfile', as('docker')),
    ...each('ipynb', as('python')),
    ...each('diff patch', as('git')),
    ...each('pem key crt cer csr der p12 pfx pub gpg asc', lock),
    ...each('toml lock pdf doc docx rtf odt rst adoc org http rest vtt srt', as('text')),
    ...each('lockb', as('bun')),
    ...each('cjsx', as('react')),
    ...each('markdown mdown mkd mdc', as('markdown')),
    ...each('avif bmp tif tiff heic heif', as('image')),
    ...each('7z rar bz2 xz tgz zst', as('zip')),
    ...each('otf woff eot', as('font')),
  },
} satisfies FileTreeIconConfig;

export { FILE_ICON_SET };
