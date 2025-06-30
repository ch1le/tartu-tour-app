import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Dimensions,
  View,
  Animated,
  PanResponder,
  Text,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';                    // ← NEW
import data from '../content.json';

/* ---------------- tweakables ---------------- */
const MAP_WIDTH_METERS = 700;
const START_DELAY_MS   = 400;
const FULL_FRAC        = 0.9;   // 90 %
const MID_FRAC         = 0.4;   // 40 %
const COLLAPSED_FRAC   = 0.1;   // 10 %

/* demo “you” location */
const USER = { lat: 58.378, lon: 26.7221 };
const m2lonDeg = (m: number, lat: number) =>
  m / (111_320 * Math.cos((lat * Math.PI) / 180));

/* ---------------- frozen POI marker ---------------- */
function FrozenMarker({ lat, lon, icon, bg, tint }: any) {
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

/* ---------------- user pin ---------------- */
function UserMarker() {
  const [tracks, setTracks] = useState(true);
  useEffect(() => { const id = setTimeout(() => setTracks(false), 500); return () => clearTimeout(id); }, []);
  return (
    <Marker coordinate={{ latitude: USER.lat, longitude: USER.lon }} tracksViewChanges={tracks}>
      <View style={styles.userPin}>
        <Feather name="flag" size={22} color="#fff" />
      </View>
    </Marker>
  );
}

/* ===================== Main Screen ===================== */
export default function MapScreen() {
  const targets = data.targets as any[];
  if (!targets.length) return null;

  /* ---- region math ---- */
  const φ0 = targets.reduce((s, t) => s + t.lat, 0) / targets.length;
  const λ0 = targets.reduce((s, t) => s + t.lon, 0) / targets.length;
  const { width, height } = Dimensions.get('window');
  const λΔ = m2lonDeg(MAP_WIDTH_METERS, φ0);
  const φΔ = λΔ * (height / width);

  /* ---- bottom sheet geometry ---- */
  const FULL_H = height * FULL_FRAC;
  const MID_H  = height * MID_FRAC;
  const COLL_H = height * COLLAPSED_FRAC;

  const OFF_FULL = 0;
  const OFF_MID  = FULL_H - MID_H;
  const OFF_COL  = FULL_H - COLL_H;

  const translateY = useRef(new Animated.Value(OFF_COL)).current;

  /* initial slide-in to mid */
  useEffect(() => {
    const id = setTimeout(() => {
      Animated.timing(translateY, { toValue: OFF_MID, duration: 450, useNativeDriver: true }).start();
    }, START_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  /* drag logic */
  const startY = useRef(OFF_MID);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => translateY.stopAnimation(v => (startY.current = v)),
      onPanResponderMove: (_, g) => {
        const ny = Math.max(OFF_FULL, Math.min(startY.current + g.dy, OFF_COL));
        translateY.setValue(ny);
      },
      onPanResponderRelease: () => {
        const y = translateY.__getValue();
        const dest = y < (OFF_FULL + OFF_MID) / 2 ? OFF_FULL :
                     y < (OFF_MID + OFF_COL) / 2  ? OFF_MID  : OFF_COL;
        Animated.spring(translateY, { toValue: dest, tension: 120, friction: 15, useNativeDriver: true }).start();
      },
    })
  ).current;

  /* ---- tag → icon palette ---- */
  const palette: any = {
    artworks:     { icon: 'paint-brush', bg: '#E74C3C', tint: '#fff' },
    museums:      { icon: 'landmark',    bg: '#3498DB', tint: '#fff' },
    architecture: { icon: 'building',    bg: '#9B59B6', tint: '#fff' },
    live:         { icon: 'music',       bg: '#F1C40F', tint: '#000' },
    bars:         { icon: 'beer',        bg: '#27AE60', tint: '#fff' },
  };

  return (
    <View style={{ flex: 1 }}>
      {/* MAP --------------------------------------------------- */}
      <MapView style={styles.map} region={{ latitude: φ0, longitude: λ0, latitudeDelta: φΔ, longitudeDelta: λΔ }}>
        <UserMarker />
        {targets.map((t, i) => (
          <FrozenMarker key={i} lat={t.lat} lon={t.lon} {...palette[t.tag]} />
        ))}
      </MapView>

      {/* BOTTOM SHEET ---------------------------------------- */}
      <Animated.View {...pan.panHandlers} style={[styles.sheet, { height: FULL_H, transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        {/* CTA row with animated emoji */}
        <View style={styles.ctaRow}>
          <LottieView
            source={require('../assets/lottie_surprise.json')}
            autoPlay
            loop
            style={{ width: 48, height: 48, marginRight: 8 }}
          />
          <Text style={styles.ctaText}>
            So many places to visit!{'\n'}Where to start?
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  map: { flex: 1 },

  pinBase: { padding: 6, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  userPin: { padding: 10, borderRadius: 28, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  sheet: {
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
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 12 },

  ctaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  ctaText: { fontSize: 16, lineHeight: 22, color: '#333' },
});
