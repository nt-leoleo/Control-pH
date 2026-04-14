/**
 * Custom Hook: usePlatform
 * Detect and track the current platform throughout the component lifecycle
 */

import { useEffect, useState } from 'react';
import { getPlatform, isNative, isAndroid, isIOS, isWeb } from './platformDetection';

export const usePlatform = () => {
  const [platform, setPlatform] = useState(null);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const detectPlatform = async () => {
      try {
        setIsLoading(true);
        const detectedPlatform = await getPlatform();
        const isNat = await isNative();
        
        setPlatform(detectedPlatform);
        setIsNativeApp(isNat);
        setError(null);
      } catch (err) {
        console.error('Error detecting platform:', err);
        setError(err);
        setPlatform('web');
        setIsNativeApp(false);
      } finally {
        setIsLoading(false);
      }
    };

    detectPlatform();
  }, []);

  return {
    platform,
    isNativeApp,
    isAndroid: platform === 'android',
    isIOS: platform === 'ios',
    isWeb: platform === 'web',
    isLoading,
    error
  };
};

export default usePlatform;
