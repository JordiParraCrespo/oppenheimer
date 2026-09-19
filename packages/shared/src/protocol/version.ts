/**
 * The wire version the runner link speaks.
 *
 * A runner announces the range it can speak in `hello`; the control plane
 * refuses anything below its own `min_supported` **with** an
 * `update_required` hint rather than dropping the socket, so a runner too old
 * to talk can still be told why (`product/versions/mvp/01-protocol.md`).
 *
 * What that floor is belongs to the control plane's configuration, not here:
 * the supported window is N-2 minor versions and a deployment may narrow it.
 */
export const PROTOCOL_VERSION = 1;
