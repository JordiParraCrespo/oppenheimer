/**
 * A QR code's modules drawn as one SVG path, dark on a light ground in both
 * themes (`qr-ink`, `qr-paper`), because that is what a phone camera reads.
 * `modules` is the encoder's square matrix, quiet zone included; null is the
 * frame of the same size with nothing in it yet.
 */
export function WhatsappQrCode({
  modules,
  label,
}: {
  modules: readonly (readonly boolean[])[] | null;
  label: string;
}) {
  const size = modules?.length ?? 0;
  let path = '';
  modules?.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });
  return (
    <div className="size-56 shrink-0 rounded-lg bg-qr-paper p-2">
      {modules ? (
        <svg
          role="img"
          aria-label={label}
          viewBox={`0 0 ${size} ${size}`}
          shapeRendering="crispEdges"
          className="size-full text-qr-ink"
        >
          <path d={path} fill="currentColor" />
        </svg>
      ) : null}
    </div>
  );
}
