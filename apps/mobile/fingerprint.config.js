// What @expo/fingerprint hashes beyond what it finds on its own. The fingerprint
// keys the native build cache (build-cache.js), so anything that ships inside
// the native binary and is not a dependency or the app config goes here.
/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  extraSources: [
    {
      // react-native-nano-icons builds its icon font from these SVGs at
      // prebuild and bundles it into the app; the plugin's config names only
      // the folder, so a changed icon would otherwise reuse the old font.
      type: 'dir',
      filePath: '../../packages/frontend/design-system/mobile/assets/icons/ui',
      reasons: ['react-native-nano-icons font'],
    },
  ],
};
