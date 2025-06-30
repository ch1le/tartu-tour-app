import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Dimensions,
  View,
  Animated,
  PanResponder,
  Text,
  ScrollView,
  ActivityIndicator,
  Platform,
  StatusBar,
  Pressable,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { FontAwesome5, Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useFonts, Raleway_500Medium } from '@expo-google-fonts/raleway';
import data from '../content.json';

/* ───── constants ────────────────────────────────────────────── */
const MAP_WIDTH_METERS = 700;
const START_DELAY_MS   = 400;
const FULL_FRAC        = 0.9;
const MID_FRAC         = 0.4;
const COLL_FRAC        = 0.1;

/* high-level categories & mapping to low-level json tags */
const TAG_PILLS = [
  'All',
  'Art',
  'History',
  'Architecture',
  'Nightlife',
  'Food & Drink',
  'Nature',
  'Live Music',
  'Museums',
  'Street Art',
] as const;

const TAG_MAP: Record<(typeof TAG_PILLS)[number], string[]> = {
  All: [],
  Art: ['artworks'],
  History: ['museums'],
  Architecture: ['architecture'],
  Nightlife: ['bars', 'live'],
  'Food & Drink': ['bars'],
  Nature: [],               // no matches yet – placeholder
  'Live Music': ['live'],
  Museums: ['museums'],
  'Street Art': ['artworks'],
};

const USER = { lat: 58.378, lon: 26.7221 };
const m2lonDeg = (m: number, lat: number) =>
  m / (111_320 * Math.cos((lat * Math.PI) / 180));

/* ───── helper markers ───────────────────────────────────────── */
function FrozenMarker({ lat, lon, icon, bg, tint }: any) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => { const id = setTimeout(() => setTracks(false), 500); return () => clearTimeout(id); }, []);
  return (
    <Marker coordinate={{ latitude: lat, longitude: lon }} tracksViewChanges={tracks}>
      <View style={[styles.pinBase, { backgroundColor: bg }]}>
        <FontAwesome5 name={icon} size={16} color={tint} />
      </View>
    </Marker>
  );
}
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

/* ───── Main Screen ──────────────────────────────────────────── */
export default function MapScreen() {
  const [fontsLoaded] = useFonts({ Raleway_500Medium });
  const [selectedCat, setSelectedCat] = useState<(typeof TAG_PILLS)[number]>('All');

  const targets = data.targets as { name:string;desc:string;lat:number;lon:number;tag:string }[];

  /* region math */
  const φ0 = targets.reduce((s, t) => s + t.lat, 0) / targets.length;
  const λ0 = targets.reduce((s, t) => s + t.lon, 0) / targets.length;
  const { width, height } = Dimensions.get('window');
  const λΔ = m2lonDeg(MAP_WIDTH_METERS, φ0);
  const φΔ = λΔ * (height / width);

  /* filter markers */
  const visibleTargets = selectedCat === 'All'
    ? targets
    : targets.filter(t => TAG_MAP[selectedCat].includes(t.tag));

  /* bottom-sheet setup */
  const FULL_H   = height * FULL_FRAC;
  const MID_H    = height * MID_FRAC;
  const COLL_H   = height * COLL_FRAC;
  const OFF_FULL = 0;
  const OFF_MID  = FULL_H - MID_H;
  const OFF_COLL = FULL_H - COLL_H;

  const translateY = useRef(new Animated.Value(OFF_COLL)).current;
  const startY     = useRef(OFF_MID);

  useEffect(() => {
    const id = setTimeout(() => {
      Animated.timing(translateY, { toValue: OFF_MID, duration: 450, useNativeDriver: true }).start();
    }, START_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => translateY.stopAnimation(v => (startY.current = v)),
      onPanResponderMove: (_, g) =>
        translateY.setValue(Math.max(OFF_FULL, Math.min(startY.current + g.dy, OFF_COLL))),
      onPanResponderRelease: () => {
        const y = translateY.__getValue();
        const dest =
          y < (OFF_FULL + OFF_MID) / 2 ? OFF_FULL :
          y < (OFF_MID + OFF_COLL) / 2 ? OFF_MID : OFF_COLL;
        Animated.spring(translateY, { toValue: dest, tension: 120, friction: 15, useNativeDriver: true }).start();
      },
    })
  ).current;

  const palette: any = {
    artworks:     { icon: 'paint-brush', bg: '#E74C3C', tint: '#fff' },
    museums:      { icon: 'landmark',    bg: '#3498DB', tint: '#fff' },
    architecture: { icon: 'building',    bg: '#9B59B6', tint: '#fff' },
    live:         { icon: 'music',       bg: '#F1C40F', tint: '#000' },
    bars:         { icon: 'beer',        bg: '#27AE60', tint: '#fff' },
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.fontOverlay}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView
        style={styles.map}
        region={{ latitude: φ0, longitude: λ0, latitudeDelta: φΔ, longitudeDelta: λΔ }}
      >
        <UserMarker />
        {visibleTargets.map((t, i) => {
          const cfg = palette[t.tag] ?? palette.artworks;
          return <FrozenMarker key={i} lat={t.lat} lon={t.lon} {...cfg} />;
        })}
      </MapView>

      {/* TAG BAR */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagContent}
        style={styles.tagBar}
      >
        {TAG_PILLS.map((tag, idx) => {
          const isSelected = tag === selectedCat;
          return (
            <Pressable
              key={tag}
              onPress={() => setSelectedCat(tag)}
              style={[
                styles.tagPill,
                isSelected && styles.tagPillSelected,
                idx === TAG_PILLS.length - 1 && { marginRight: 32 },
              ]}
            >
              <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* BOTTOM SHEET */}
      <Animated.View
        {...pan.panHandlers}
        style={[styles.sheet, { height: FULL_H, transform: [{ translateY }] }]}
      >
        <View style={styles.handle} />
        <View style={styles.ctaRow}>
          <LottieView
            source={require('../assets/lottie_surprise.json')}
            autoPlay
            loop
            style={{ width: 48, height: 48, marginRight: 12 }}
          />
          <Text style={styles.ctaText}>
            So many places to visit!{'\n'}Where to start?
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

/* ── styles ─────────────────────────────────────────── */
const STATUS = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;

const styles = StyleSheet.create({
  map: { flex: 1 },

  tagBar: {
    position: 'absolute',
    top: STATUS + 10,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  tagContent: { paddingLeft: 16, alignItems: 'center' },
  tagPill: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 12,
  },
  tagText: { fontFamily: 'Raleway_500Medium', fontSize: 14, color: '#333' },

  tagPillSelected: { backgroundColor: '#333' },
  tagTextSelected: { color: '#fff' },

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

  ctaRow: { flexDirection: 'row', alignItems: 'center' },
  ctaText: { fontFamily: 'Raleway_500Medium', fontSize: 20, lineHeight: 24, color: '#333' },

  fontOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
