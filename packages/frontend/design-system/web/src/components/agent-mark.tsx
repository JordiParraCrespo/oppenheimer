import { BotIcon, SquareTerminalIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

type AgentId =
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'grok'
  | 'pi'
  | 'omp'
  | 'antigravity'
  | 'zcode'
  | 'fx'
  | 'hermes'
  | 'muse'
  | 'qwen'
  | 'glm'
  | 'chatgpt'
  | 'cursor'
  | 'shell'
  | (string & {});

const CLAUDE_ORANGE = '#D97757';

function ClaudeMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill={CLAUDE_ORANGE} aria-hidden {...props}>
      <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
    </svg>
  );
}

function OpenAIMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function OpenCodeMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 6 24 30" fill="currentColor" aria-hidden {...props}>
      <path d="M18 30H6V18H18V30Z" opacity="0.45" />
      <path d="M18 12H6V30H18V12ZM24 36H0V6H24V36Z" />
    </svg>
  );
}

function GrokMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden {...props}>
      <path d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
    </svg>
  );
}

/** Pi's three blocks, in its own colours, cropped to the drawing (`pi.dev/logo-auto.svg`). */
function PiMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="165.29 165.29 469.43 469.43" aria-hidden {...props}>
      <path fill="#F09082" d="M165.29 165.29H517.36V400H400V282.65H165.29Z" />
      <path fill="#4D9ABF" d="M165.29 282.65H282.65V400H400V517.36H282.65V634.72H165.29Z" />
      <path fill="#F1BE58" d="M517.36 400H634.72V634.72H517.36Z" />
    </svg>
  );
}

/**
 * Oh My Pi's gradient π (`omp.sh/favicon.svg`), without the favicon's dark
 * tile, which at 15px would read as a black square. The gradient's id is per
 * instance, since several marks share one document.
 */
function OmpMark(props: React.ComponentProps<'svg'>) {
  const id = React.useId();
  return (
    <svg viewBox="12 16 40 40" aria-hidden {...props}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ed4abf" />
          <stop offset=".5" stopColor="#9b4dff" />
          <stop offset="1" stopColor="#5ad8e6" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M14 16h36v8H40v32h-8V24h-6v22h-8V24h-4z" />
    </svg>
  );
}

/**
 * fx's tile, the white "fx" on a black rounded square, as the binary embeds
 * it in its sign-in page (fx v0.0.17). The tile stays, unlike Oh My Pi's: it
 * is the mark itself rather than a backdrop, and the black is fx's own, so it
 * does not re-point in dark.
 */
function FxMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 180 180" aria-hidden {...props}>
      <rect width="180" height="180" rx="37" fill="#000" />
      <g transform="translate(34 33.95) scale(0.7186) translate(-166.241 0)">
        <path
          fill="#fff"
          d="M237.892 0C243.178 0 249.383 1.419 253.025 3.074L255.093 4.014L250.076 18.63L247.677 17.746C244.901 16.723 241.938 15.8 238.491 15.8C234.984 15.8 232.787 16.56 231.08 18.321C229.231 20.23 227.629 23.64 226.229 29.758L225.136 34.851H241.669L260.432 34.95L260.694 34.951L260.842 35.169L278.854 61.633L296.736 34.95H320.866L291.676 76.74L322.102 119.75H299.331L299.182 119.546L241.144 40.478L239.35 49.4H222.069L205.688 127.208C203.927 135.709 201.185 142.838 196.777 147.866C192.27 153.008 186.201 155.75 178.342 155.75C174.181 155.75 170.746 155.109 167.909 154.107L166.241 153.519V137.182L166.899 137.4L169.531 138.278C172.182 139.162 174.414 139.8 177.142 139.8C178.528 139.8 179.703 139.526 180.732 138.98C181.764 138.434 182.677 137.6 183.52 136.442C185.304 133.989 186.716 130.135 187.897 124.672L203.76 49.4H189.874L191.759 39.438L192.039 39.346L206.818 34.467L208.154 28.642C210.516 18.207 213.772 10.938 218.708 6.318C223.737 1.612 230.127 0 237.892 0ZM273.987 99.084L260.073 120.25H234.541L261.003 82.022L273.987 99.084Z"
        />
      </g>
    </svg>
  );
}

function AntigravityMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z" />
    </svg>
  );
}

/** Nous Research's Hermes, the bust its agent wears (Lobe Icons' `hermesagent.svg`). */
function HermesMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden {...props}>
      <path d="M6 12.8q0 0 .3.2v.1zm2.4-3.4h.7l.6.2h.1-.6L9 9.4l.6.1.8.5h.1l.1.1h.3q0 .2.1.1 0 .2-.3.2v.2q.1.2-.4.2v.1h-.1v.2H10v.1h-.3v.1H8.3Q8.2 11 8 11h.2l.5.1h.6q.5 0 .7-.4l.2-.2-.4-.3q0 .2-.2.2v.3l-.2.2h-.6l-.2-.2v-.2q-.2 0-.1-.4v-.1l-.4.4h-.2v-.2l.1-.4h-.2q.2-.3.6-.5M8 10.8z" />
      <path clipRule="evenodd" d="M12 0h1.4l2.5.9a7 7 0 0 1 3 2.6l.7 1.5.7 1.7.4 2 .3 1.5.5 2.1 1.2 4.8V19q0 .6-.2 1.2l-1 1.6v.2l.6-.6q.6-.7 1-1.5a4 4 0 0 0 .3-1.7q0-.6-.3-1.2v-.1h.1l.3.4q.5.7.5 1.7a4 4 0 0 1-.5 2q-.5.9-1.5 1.4l-.6.3q-.2.2-.3.4v.6l-.2.1-.1-.1v-.2l-.4-.9-.7-1-1-.4-.6-.2h-.2l.5.2a4 4 0 0 1 2 1.6l.2.5v.6h-.1l-.1-.2-.1-.2-1.4-1.7-.6-.3-1.1-.2h-.6l-.8.4-.8.7-1 1-.3.6v.1h-.4v-.4q0-.5.4-1l.1.1 1-1.1.9-.6h-.1l-.5.2q-.6.1-1.1.5l-.4.4-1 1.7-.1.1v.1h-.6l.4-.5.7-.9.1-.1.8-1q.1 0 .3-.2H14l-.7.5-1.2.7-1 .5.1-.3-.4.3-.4.5-.4.4-.1.1H8.8v-.3h-.2v.3h-.2l.2-.3q-.4 0-.6.3H5.2l.5-.7q.6-.7.7-1.6l-.4.4q-.4.5-1 .5l-.9-.1q-.6-.3-.7-1.1 0-.2-.2-.2L2 20.6a2 2 0 0 1-.8-1.1L1 18.2l.2.5q0 .4.5.9l.9.5h1l.7-.5q.5-.4.6-1.2v-.1.2q-.6.8-1.3 1.1-.5.3-1 .2a2 2 0 0 1-1-.7l-.4-.9v-.9c0-.4.5-1.2.7-1.3v.2l-.1.3-.1.9q0 .3.2.6.3.4.6.4h.8l.3-.6q.3-.5.3-1.1l.2-1V15l.1-.7.1-.7V13l.1-.5V12l.1-.7V11l-.6-.4-.2-.4h-.2l.3.5.2.3q.1 0 .2.2H4a3 3 0 0 1-1.3-.9Q2 9.7 2 8.7v-1q0-1 .4-1.8L3 4.8l.7-1q.8-.9 1.7-1.5A13 13 0 0 1 11.3 0zM10 22.8l-.2.2-.6.9.5-.5.3-.4zm1.7-3.7-.7.6-.3.4-.4.3h-.6v.2l.5.7.4.7.1.4h.2l.9-.5.6-.3 1-.7h.1l-.8-.5-.5-.5-.4-.6zm-5.9.3-.1.3-.5 1q-.3.4-.8.5h-.9v.2l.5.2h.5q.2 0 .4-.2.4-.3.6-.7l.3-1.1zm15-4.6v.6l.2.6v1l-.2 1-.4 1.5v.1l.3-.3q.5-.5.6-1 .3-.7.1-1.6 0-.9-.6-1.9M5.8 8.3v.1l.4.8v.2q-.4 0-.9.2l.2.1v.2l.5.4.2.6q-.2.8-.7 1.2h-.2l-.1.3v.2l.4.5.2.3v.7l.1.1h.5l.5.3.4.2h.3v.2l-.3.1H7h.2q-.5-.3-.9-.1v.3q-.2-.1 0-.3a.2.2 0 0 0-.3.2q0 .1.2.2h.5l-.3.2v.1h-.2l-.2-.2L6 15v-.2q-.1 0 0-.2h-.1l-.2-.4v-.4l.1-.1v-.2l-.1-.4-.5-.5-.1.6q0 .5.2 1 .1.8.5 1.2l1 1.8q.3.3.7.3H8l.9-.2h.5q.3 0 .6.2l1 1.3q0 .2.1 0l.4-.3v-2.1l.4-2.3.3-1.5.2-1.9V9.6q0-.2-.2-.2l-.6-.1q-.2 0-.2-.2v-.2l-.1.2-.1.1H9.4L9.2 9q0-.1-.2 0l-.5.1-.7.4-.3.2h-.2v-.2l.3-.3H7q-.2.2-.4 0L6 8.4zm8.6 9h-.2l-.6.4-.3.2v.6l.3.1h.3q.4 0 .6-.3v-.9zm-.3-2.5-.3 1-.4 1.3.8-.5q0 0 0-.2v-1.6m3.1-8 .1.2.3.7.5 2 .6 1.9.3 1.1.2.8.1.6.1.4V14l-.1-.6v-.2l-.4-1.2-.6-2-.5-1.7-.2-.7-.1-.4-.1-.3zm-11 7.5h-.1l.4.1zm-1-2.3zm0-1.2v.8q.1.3.4.1l-.1-.3q0 0 0-.2l-.2-.2v-.2m0-1-.4.1v.5h.6l.5.2.1.1-.1-.3H5q.4-.2.7 0 0-.2-.2-.3l-.3-.1zm10.3.3-.6.3h-.1l.2.1h1.4l-.5-.3zM8 6.5v.1l.2 1 .5 1v.2H9l-.4-1q-.4-.6-.6-1.3m2.4-6h-.6L9 .7l-.9.3H10l1.3.6a6 6 0 0 1 2.3 2.7l.7 2.4.1.2q.2 0 .3.2 0 .1-.2.3l-.2.3.3-.3.1-.3v-.2l-.1-.1q-.2 0-.2-.2t.2-.4h.3l.5-.1q.2 0 .2.2l-.1.3h-.1a.1.1 0 0 0 0 .2q0 .2.2.4l.6.3h.1l-.6-.3-.1-.1-.2-.2.2-.2.1-.2-.2-1-.8-2-1.4-1.8-1.2-.8-1-.3zM4.1 3.9 4 4l-.4.4-.2.2q-.4.3-.6.9v.2H3V6l-.2.5L3 6l1-2zm13 2.4zM4.2 4.5l-.2.2h-.2q-.2 0-.3.2l-.2.6-.1.3h.4v.3l-.1.1v-.1l.3-.4.1-.1V6q.2-.1.3-.1v.2l.5-1q-.1 0-.4 0l.1-.5q0 .3-.3.1v-.3zm2-.7-.2.4-.5.7q-.1.3-.6.5v-.1l.2-.6L5 5l-.5 1h.1q.2 0 .3-.2l.1-.1.2-.1h.1v.1l.1.2v.1L6 4.6l.3-.8m4-.3.2.6v.4l-.1-.1h-.1v.2l-.3.2h-.1v-.1h-.2l-.4.2v.4l.1.1q.3 0 .7.3l.1-.2h.3v.2q0-.2 0-.4l.4.6v-.6h.1l.2.5v-.4h.3c0-.2-.4-1-.8-1.5zm-2.6.7-.2.6-.2.2h-.6l-.4-.2H6L6 5v.5h.4q.2 0 .4 0l.5-.2h.1l.1.2v-.2l.2.2zm.3.3-.1.1v.1l.1.6h.9l.2.2h.1v-.3l-.3-.6H8M18 2.8l.2.5v.5H18l-.2-.2-.3-.3h-.1l.2.3v.2h-.3l-.2.1V4q.2.2 0 .2l-.1.2h-.2l-.7-.1L16 4l-.1-.2v.5h-.6v.2h.3l.5.3.2.3v-.3l.1.1.2.3v.1h.1l-.4-1 1 .4.2-.2h.1l.3.5.1.3v-.3l-.3-.6q.3.1.6.8l-.1-.5v-.3h.1v-.1l.3.3-.2-.5h.2v-.8l.3.4V4l-.3-.6zm-6.5.3v.4l-.3.1-.1.4-.1.1v.2l.1.2.1.1h.3l.2.1.2-.1h.3v-.3h.1v-.7q.2 0 .3.3l.5.8h.4l-.2-.4H13l-.5-.9-.3-.2-.3.3h-.2l-.1-.3z" />
    </svg>
  );
}

/** Meta's mark, which Muse Code, a Meta product with no mark of its own, wears. */
function MetaMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </svg>
  );
}

const QWEN_BLUE = '#082DFF';

/** Qwen's mark, the one Qwen Code ships as its web shell's icon. */
function QwenMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="17.5 27.7 135.6 135.6" fill={QWEN_BLUE} aria-hidden {...props}>
      <path d="M130.06,43.66h-33.37c0-1.42-.37-2.84-1.1-4.11l-4.47-7.74c-1.47-2.54-4.18-4.11-7.12-4.11h-8.93c-2.94,0-5.65,1.57-7.12,4.11l-13.68,23.69c-1.47,2.54-1.47,5.67,0,8.22l4.47,7.74c1.47,2.54,4.18,4.11,7.12,4.11h64.19c2.94,0,5.65-1.57,7.12-4.11l4.47-7.74c1.47-2.54,1.47-5.67,0-8.22l-4.47-7.74c-1.47-2.54-4.18-4.11-7.12-4.11Z" />
      <path d="M19.75,83.66l16.68,28.9c-1.23.71-2.27,1.74-3.01,3.01l-4.47,7.74c-1.47,2.54-1.47,5.67,0,8.22l4.47,7.74c1.47,2.54,4.18,4.11,7.12,4.11h27.35c2.94,0,5.65-1.57,7.12-4.11l4.47-7.74c1.47-2.54,1.47-5.67,0-8.22l-32.1-55.59c-1.47-2.54-4.18-4.11-7.12-4.11h-8.93c-2.94,0-5.65,1.57-7.12,4.11l-4.47,7.74c-1.47,2.54-1.47,5.67,0,8.22Z" />
      <path d="M109.55,159.19l16.68-28.9c1.23.71,2.64,1.1,4.11,1.1h8.93c2.94,0,5.65-1.57,7.12-4.11l4.47-7.74c1.47-2.54,1.47-5.67,0-8.22l-13.68-23.69c-1.47-2.54-4.18-4.11-7.12-4.11h-8.93c-2.94,0-5.65,1.57-7.12,4.11l-32.1,55.59c-1.47,2.54-1.47,5.67,0,8.22l4.47,7.74c1.47,2.54,4.18,4.11,7.12,4.11h8.93c2.94,0,5.65-1.57,7.12-4.11Z" />
    </svg>
  );
}

function CursorMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  );
}

function ZaiMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden {...props}>
      <path d="M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z" />
    </svg>
  );
}

const SHARED = 'size-[15px] shrink-0';
const INKED = cn(SHARED, 'text-fg');

/** The mark per known id; anything else draws the bot glyph. */
const MARKS: Readonly<Record<string, () => React.ReactNode>> = {
  'claude-code': () => <ClaudeMark className={SHARED} />,
  codex: () => <OpenAIMark className={INKED} />,
  opencode: () => <OpenCodeMark className={INKED} />,
  grok: () => <GrokMark className={INKED} />,
  pi: () => <PiMark className={SHARED} />,
  omp: () => <OmpMark className={SHARED} />,
  antigravity: () => <AntigravityMark className={INKED} />,
  zcode: () => <ZaiMark className={INKED} />,
  fx: () => <FxMark className={SHARED} />,
  hermes: () => <HermesMark className={INKED} />,
  muse: () => <MetaMark className={INKED} />,
  qwen: () => <QwenMark className={SHARED} />,
  glm: () => <ZaiMark className={INKED} />,
  chatgpt: () => <OpenAIMark className={INKED} />,
  cursor: () => <CursorMark className={INKED} />,
  shell: () => <SquareTerminalIcon className={SHARED} strokeWidth={2} aria-hidden />,
};

function markOf(agent: AgentId): React.ReactNode {
  return Object.hasOwn(MARKS, agent) ? (
    MARKS[agent]()
  ) : (
    <BotIcon className={SHARED} strokeWidth={2} aria-hidden />
  );
}

/**
 * AgentMark — the coding agent's mark, 15px, in the agent and model picker
 * and wherever a session names its harness; a bot's model picker draws its
 * providers with it too. Claude Code carries Anthropic's orange (a brand
 * colour, so it does not re-point in dark); Codex, OpenCode, Grok,
 * Antigravity, Hermes, Muse, GLM, ChatGPT and Cursor draw in the current ink
 * and invert with the theme, and ZCode wears Z.ai's mark, as GLM does. ChatGPT
 * has no published mark of its own and wears OpenAI's, as Codex does, and
 * Muse Code wears Meta's. "Blank
 * terminal" takes a terminal glyph, and an unknown id the neutral bot glyph.
 * Pi's blocks, Oh My Pi's gradient π, fx's black tile and Qwen's blue carry
 * their own colours, which do not re-point in dark either.
 *
 * Inline SVG, so no asset pipeline and it scales with the text. Sources, never
 * a redrawn imitation: the Claude and OpenAI marks from Simple Icons (CC0);
 * OpenCode's from the first glyph of `packages/web/src/assets/logo-ornate-dark.svg`
 * in github.com/sst/opencode; Grok's, Antigravity's and GLM's (Z.ai's) from Lobe Icons
 * (`@lobehub/icons-static-svg` `icons/grok.svg`, `icons/antigravity.svg` and
 * `icons/zai.svg`, MIT); Hermes' from the same set (`@lobehub/icons-static-svg@1.106.0`
 * `icons/hermesagent.svg`, MIT), its coordinates rounded to a tenth of a unit
 * (svgo, precision 1) since the original spends 20 KB on a 15px glyph;
 * Cursor's and Meta's from Simple Icons (`simple-icons@16.0.0`
 * `icons/cursor.svg` and `icons/meta.svg`, CC0);
 * Pi's from its site's own download (`pi.dev/logo-auto.svg`) and Oh My Pi's
 * from its site's favicon (`omp.sh/favicon.svg`); fx's from the sign-in page
 * its own binary serves (`vercel-labs/fx` v0.0.17); Qwen's from the icon
 * Qwen Code's package ships (`@qwen-code/qwen-code@0.28.4`
 * `web-shell/assets/icon.svg`, Apache-2.0).
 *
 * ```tsx
 * <AgentMark agent="claude-code" />
 * <AgentMark agent="opencode" className="size-4" />
 * ```
 */
function AgentMark({
  agent,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & { agent: AgentId }) {
  return (
    <span
      data-slot="agent-mark"
      data-agent={agent}
      className={cn('inline-flex shrink-0 items-center justify-center text-fg-subtle', className)}
      {...props}
    >
      {markOf(agent)}
    </span>
  );
}

export { AgentMark };
export type { AgentId };
