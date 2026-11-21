// Inputs that end up inside the native binary, named once for the config
// plugin that reads them (app.config.ts) and for the fingerprint that keys the
// native build cache (fingerprint.config.js), so the two cannot drift: an icon
// folder the fingerprint no longer sees would reuse an app with the old font.

// The SVGs react-native-nano-icons builds its icon font from at prebuild.
const ICONS_DIR = '../../packages/frontend/design-system/mobile/assets/icons/ui';

module.exports = { ICONS_DIR };
