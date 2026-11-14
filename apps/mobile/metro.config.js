const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// The factory the base config comes from: Expo's, unless a feature has to
// build the base itself rather than adjust the finished config.
const createConfig =
  // oppenheimer:plugins metro-config-factory
  getDefaultConfig;

const config = createConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

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

  return (previousResolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(wrapWithReanimatedMetroConfig(config), {
  input: './global.css',
  inlineRem: 16,
});
