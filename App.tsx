/* App.tsx --------------------------------------------------------- */
import React, { useEffect, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_700Bold,
} from '@expo-google-fonts/raleway';

import MapScreen from './src/MapScreen';   // adjust path if needed

// Don’t auto‑hide until we’re ready:
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [ready, setReady] = React.useState(false);

  // Load fonts once
  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          'Raleway': Raleway_400Regular,
          'Raleway-Medium': Raleway_500Medium,
          'Raleway-Bold': Raleway_700Bold,
        });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Hide splash as soon as fonts are ready and the UI is mounted
  const onLayoutRootView = useCallback(async () => {
    if (ready) await SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;           // keep the splash screen

  return <MapScreen onLayout={onLayoutRootView} />;
}
