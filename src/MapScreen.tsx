import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Dimensions,
  View,
  Animated,
  PanResponder,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import data from '../content.json';

/* ------------------- tweakables ------------------- */
const MAP_WIDTH_METERS = 700;
const START_DELAY_MS   = 2000;   // card appears after this delay
const EXPANDED_FRAC    = 0.4;   // 40 % of the screen
const COLLAPSED_FRAC   = 0.1;   // 10 % of the screen

/* ------------------- helpers ---------------------- */
const USER = { lat: 58.378, lon: 26.7221 };
const metersToLonDeg = (m: number, lat: number) =>
  m / (111_320 * Math.cos((lat * Math.PI) / 180));

/* reusable frozen marker */
function POIMarker({
  lat,
  lon,
  icon,
  bg,
  tint,
}: {
  lat: number;
  lon: number;
  icon: string;
  bg: string;
  tint: string;
}) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker coordinate={{ latitude: lat, longitude: lon }} tracksViewChanges={tracks}>
      <View style={[styles.pinBase, { backgroundColor: bg }]}>
        <FontAwesome5 name={icon} size={16} color={tint} />
      </View>
    </Marker>
  );
}

/* user marker */
function UserMarker() {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracks(false), 500);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker
      coordinate={{ latitude: USER.lat, longitude: USER.lon }}
      tracksViewChanges={tracks}
      title="You (demo)"
    >
      <View style={styles.userPin}>
        <Feather name="flag" size={22} color="#fff" />
      </View>
    </Marker>
  );
}

/* =================== Main Screen =================== */
export default function MapScreen() {
  const targets = data.targets as {
    name: string;
    desc: string;
    lat: number;
    lon: number;
    tag: string;
  }[];
  if (!targets.length) return null;

  /* map region */
  const latAvg = targets.reduce((s, t) => s + t.lat, 0) / targets.length;
  const lonAvg = targets.reduce((s, t) => s + t.lon, 0) / targets.length;
  const { width, height } = Dimensions.get('window');
  const lonDelta = metersToLonDeg(MAP_WIDTH_METERS, latAvg);
  const latDelta = lonDelta * (height / width);

  /* tag → icon table */
  const icons: Record<string, { name: string; bg: string; tint: string }> = {
    artworks:     { name: 'paint-brush', bg: '#E74C3C', tint: '#fff' },
    museums:      { name: 'landmark',    bg: '#3498DB', tint: '#fff' },
    architecture: { name: 'building',    bg: '#9B59B6', tint: '#fff' },
    live:         { name: 'music',       bg: '#F1C40F', tint: '#000' },
    bars:         { name: 'beer',        bg: '#27AE60', tint: '#fff' },
  };

  /* bottom-sheet geometry */
  const EXPANDED = height * EXPANDED_FRAC;
  const COLLAPSED = height * COLLAPSED_FRAC;
  const DRAG_RANGE = EXPANDED - COLLAPSED;

  /* translateY: 0 (expanded) … DRAG_RANGE (collapsed) */
  const translateY = useRef(new Animated.Value(DRAG_RANGE)).current;

  /* initial slide-up after delay */
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start();
    }, START_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  /* drag handling */
  const startY = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        translateY.stopAnimation(v => (startY.current = v));
      },
      onPanResponderMove: (_, g) => {
        let newY = startY.current + g.dy;
        newY = Math.max(0, Math.min(newY, DRAG_RANGE));
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, g) => {
        const mid = DRAG_RANGE / 2;
        const dest =
          g.vy > 0 || translateY.__getValue() > mid ? DRAG_RANGE : 0;
        Animated.spring(translateY, {
          toValue: dest,
          useNativeDriver: true,
          tension: 120,
          friction: 15,
        }).start();
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }}>
      {/* ---------- MAP ---------- */}
      <MapView
        style={styles.map}
        region={{
          latitude: latAvg,
          longitude: lonAvg,
          latitudeDelta: latDelta,
          longitudeDelta: lonDelta,
        }}
      >
        <UserMarker />
        {targets.map((t, i) => {
          const icon = icons[t.tag] ?? icons.artworks;
          return (
            <POIMarker
              key={i}
              lat={t.lat}
              lon={t.lon}
              icon={icon.name}
              bg={icon.bg}
              tint={icon.tint}
            />
          );
        })}
      </MapView>

      {/* ---------- BOTTOM SHEET ---------- */}
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.card,
          { height: EXPANDED, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.cardHandle} />
        {/* place any content here */}
      </Animated.View>
    </View>
  );
}

/* ===================== styles ===================== */
const styles = StyleSheet.create({
  map: { flex: 1 },

  pinBase: {
    padding: 6,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userPin: {
    padding: 10,
    borderRadius: 28,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -3 },
    padding: 16,
    alignItems: 'center',
  },
  cardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 12,
  },
});
