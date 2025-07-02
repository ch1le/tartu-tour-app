// App.tsx  – root of the Expo project
import 'react-native-gesture-handler';           // ← MUST be first
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

import MapScreen from './src/MapScreen';         // your screen component

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <MapScreen />
    </GestureHandlerRootView>
  );
}
