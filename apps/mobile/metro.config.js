const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getSentryExpoConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// @gorhom forks ship as git tarballs; compile them (and the two peers they
// import from source) against this app's RN/reanimated. See rn-bedrock workarounds.
const sourceEntries = new Map(
  ['@gorhom/bottom-sheet', 'react-native-gesture-handler', 'react-native-reanimated'].map(
    (name) => [name, require.resolve(`${name}/src/index.ts`)],
  ),
);

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const singletons = ['react', 'react-native', 'react-native-css-interop'];
  if (singletons.includes(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, {
        paths: [projectRoot, workspaceRoot],
      }),
    };
  }

  const sourceEntry = sourceEntries.get(moduleName);
  if (sourceEntry !== undefined) return { type: 'sourceFile', filePath: sourceEntry };

  return (previousResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(wrapWithReanimatedMetroConfig(config), {
  input: './global.css',
  inlineRem: 16,
});
