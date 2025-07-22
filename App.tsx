/********************************************************************
 * App.tsx  — wraps the app in GestureHandlerRootView
 *******************************************************************/
import 'react-native-gesture-handler';              // ← must be first!
import React, { useEffect, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import {
  Raleway_400Regular,
  Raleway_500Medium,
  Raleway_700Bold,
} from '@expo-google-fonts/raleway';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import MapScreen from './src/MapScreen';            // your v78 screen

// keep splash visible until fonts are ready
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [ready, setReady] = React.useState(false);

  /* load fonts once */
  useEffect(() => {
    (async () => {
      try {
        await Font.loadAsync({
          Raleway: Raleway_400Regular,
          'Raleway-Medium': Raleway_500Medium,
          'Raleway-Bold': Raleway_700Bold,
        });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  /* hide splash after UI mounts */
  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;                          // keep splash

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <MapScreen />
    </GestureHandlerRootView>
  );
}
