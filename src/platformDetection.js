/**
 * Platform Detection Utility
 * Detect whether the app is running on Capacitor/Android or in a web browser
 */

let platformCache = null;

/**
 * Get the current platform
 * @returns {string} 'android' | 'ios' | 'web'
 */
export const getPlatform = async () => {
  if (platformCache) return platformCache;

  try {
    const { Capacitor } = window;
    if (Capacitor && Capacitor.getPlatform) {
      platformCache = Capacitor.getPlatform();
      return platformCache;
    }
  } catch (error) {
    console.warn('Capacitor not available:', error.message);
  }

  platformCache = 'web';
  return platformCache;
};

/**
 * Get cached platform synchronously (after first async call)
 * @returns {string|null}
 */
export const getPlatformSync = () => platformCache;

/**
 * Check if running on Android
 * @returns {Promise<boolean>}
 */
export const isAndroid = async () => {
  const platform = await getPlatform();
  return platform === 'android';
};

/**
 * Check if running on iOS
 * @returns {Promise<boolean>}
 */
export const isIOS = async () => {
  const platform = await getPlatform();
  return platform === 'ios';
};

/**
 * Check if running on native (Android or iOS)
 * @returns {Promise<boolean>}
 */
export const isNative = async () => {
  const platform = await getPlatform();
  return platform !== 'web';
};

/**
 * Check if running in web browser
 * @returns {Promise<boolean>}
 */
export const isWeb = async () => {
  const platform = await getPlatform();
  return platform === 'web';
};

/**
 * Check if running on native (sync version, may return null if not initialized)
 * @returns {boolean|null}
 */
export const isNativeSync = () => {
  if (platformCache === null) return null;
  return platformCache !== 'web';
};

/**
 * Initialize platform detection (call once on app startup)
 */
export const initPlatformDetection = async () => {
  await getPlatform();
};
