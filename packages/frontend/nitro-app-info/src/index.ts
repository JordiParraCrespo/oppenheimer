import { Platform } from 'react-native';
import { NitroModules } from 'react-native-nitro-modules';
import type { AppInfo } from './AppInfo.nitro';

function loadModule(): AppInfo {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    throw new Error('app-info: this platform is not implemented');
  }
  return NitroModules.createHybridObject<AppInfo>('AppInfo');
}

/** The loader is the only place that knows the platform matrix. */
export const appInfo = loadModule();
