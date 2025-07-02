/********************************************************************
 * MapScreen.tsx – tap map → hide keyboard & collapse sheet (25 %)
 *******************************************************************/
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Dimensions,
  View,
  Text,
  ScrollView,
  Pressable,
  Keyboard,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';

import MapView, { Marker } from 'react-native-maps';

import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';

import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useFonts, Raleway_500Medium } from '@expo-google-fonts/raleway';

import data from '../content.json';

/* ── constants ───────────────────────── */
const STATUS = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;
const TAGS = ['All', 'Art', 'History', 'Architecture', 'Nightlife', 'Food & Drink'] as const;
const TAG_FILTER: Record<(typeof TAGS)[number], string[]> = {
  All: [], Art: ['artworks'], History: ['museums'],
  Architecture: ['architecture'], Nightlife: ['bars', 'live'],
  'Food & Drink': ['bars'],
};
const USER = { lat: 58.378, lon: 26.7221 };
const m2lonDeg = (m: number, lat: number) =>
  m / (111_320 * Math.cos((lat * Math.PI) / 180));
const isFiniteCoord = (p: { lat: number; lon: number }) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lon);

/* ── memoised dot marker ─────────────── */
const Dot = () => <View style={styles.dot} />;
const DotMarker = React.memo(({ lat, lon }: { lat: number; lon: number }) => {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracks(false), 300);
    return () => clearTimeout(id);
  }, []);
  return (
    <Marker coordinate={{ latitude: lat, longitude: lon }} tracksViewChanges={tracks}>
      <Dot />
    </Marker>
  );
});

/* ── memoised map block (with onMapPress prop) ── */
const MemoMap = React.memo(
  React.forwardRef<
    MapView,
    {
      startRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
      targetRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
      points: { lat: number; lon: number }[];
      onMapPress: () => void;
    }
  >(({ startRegion, targetRegion, points, onMapPress }, ref) => (
    <MapView
      ref={ref}
      style={{ flex: 1 }}
      initialRegion={startRegion}
      onPress={onMapPress}
onLongPress={onMapPress}
onPanDrag={onMapPress}
      onMapReady={() =>
        (ref as React.RefObject<MapView>).current?.animateToRegion(targetRegion, 1200)
      }
    >
      {points.map((p, i) => <DotMarker key={i} lat={p.lat} lon={p.lon} />)}
      <Marker coordinate={{ latitude: USER.lat, longitude: USER.lon }} zIndex={999}>
        <View style={styles.userPin}>
          <Feather name="flag" size={18} color="#fff" />
        </View>
      </Marker>
    </MapView>
  )),
);

export default function MapScreen() {
  /* ─ hooks ─ */
  const [fontsLoaded] = useFonts({ Raleway_500Medium });
  const [cat, setCat] = useState<(typeof TAGS)[number]>('All');
  const [prompt, setPrompt] = useState('');
  const [msgs, setMsgs] = useState<string[]>([]);
  const [showInput, setShowInput] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView>(null);

  /* helpers that need sheetRef */
  const collapseSheet = () => sheetRef.current?.snapToIndex(0);
  const dismissKeyboardAndCollapse = () => {
  Keyboard.dismiss();
  sheetRef.current?.snapToIndex(0);  // 25 % snap-point
};

  /* reveal input after 300 ms */
  useEffect(() => {
    const id = setTimeout(() => setShowInput(true), 300);
    return () => clearTimeout(id);
  }, []);

  /* data once */
  const allTargets = useMemo(() => {
    const raw = data.targets as { lat: number; lon: number; tag: string }[];
    return raw.filter(isFiniteCoord);
  }, []);

  /* region calc */
  const { width, height } = Dimensions.get('window');
  const [startRegion, targetRegion] = useMemo(() => {
    const φ0 = allTargets.reduce((s, t) => s + t.lat, 0) / allTargets.length;
    const λ0 = allTargets.reduce((s, t) => s + t.lon, 0) / allTargets.length;
    const λΔ = m2lonDeg(700, φ0);
    const φΔ = λΔ * (height / width);
    return [
      { latitude: φ0, longitude: λ0, latitudeDelta: 60, longitudeDelta: 60 },
      { latitude: φ0, longitude: λ0, latitudeDelta: φΔ, longitudeDelta: λΔ },
    ];
  }, [allTargets, width, height]);

  /* visible points */
  const visible = useMemo(
    () => (cat === 'All' ? allTargets : allTargets.filter(p => TAG_FILTER[cat].includes(p.tag))),
    [cat, allTargets],
  );

  if (!fontsLoaded) return <View style={styles.loader}><ActivityIndicator size="large" /></View>;

  /* send chat */
  const send = () => {
    const txt = prompt.trim();
    if (!txt) return;
    setMsgs(p => [...p, txt]);
    setPrompt('');
  };

  /* ─ UI ─ */
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* tag pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tagBar} contentContainerStyle={{ paddingLeft: 16 }}>
        {TAGS.map(t => {
          const sel = t === cat;
          return (
            <Pressable key={t} onPress={() => setCat(t)}
              style={[styles.tagPill, sel && styles.tagSel]}>
              <Text style={[styles.tagTxt, sel && styles.tagSelTxt]}>{t}</Text>
            </Pressable>);
        })}
      </ScrollView>

      {/* map */}
      <MemoMap
        ref={mapRef}
        startRegion={startRegion}
        targetRegion={targetRegion}
        points={visible}
        onMapPress={dismissKeyboardAndCollapse}
      />

      {/* bottom-sheet */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={['25%', '70%']}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        animateOnMount={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        {/* CTA row */}
        <View style={styles.sheetHeader}>
          <LottieView source={require('../assets/lottie_surprise.json')}
            autoPlay loop style={{ width: 24, height: 24, marginRight: 8 }} />
          <Text style={styles.headerTxt}>
            Oooh, So many interesting places.{'\n'}
            Where&nbsp;oh&nbsp;where&nbsp;to&nbsp;start…
          </Text>
        </View>

        {/* TextInput row */}
        {showInput && (
          <View style={styles.inputRow}>
            <BottomSheetTextInput
              style={styles.inputField}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Mmm, I'm thinking of coffee…"
              placeholderTextColor="#888"
              multiline
            />
            <Pressable style={styles.sendBtn} onPress={send}>
              <Feather name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* messages */}
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={collapseSheet}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 }}
        >
          {msgs.map((m, i) => (
            <View key={i} style={styles.userBubble}>
              <Text style={styles.bubbleTxt}>{m}</Text>
            </View>
          ))}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

/* ── styles ─ */
const styles = StyleSheet.create({
  tagBar: { position: 'absolute', top: STATUS + 8, left: 0, right: 0, zIndex: 20 },
  tagPill: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 10 },
  tagSel: { backgroundColor: '#333' },
  tagTxt: { fontFamily: 'Raleway_500Medium', fontSize: 14, color: '#333' },
  tagSelTxt: { color: '#fff' },

  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
  userPin: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#000',
    borderWidth: 2, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },

  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  headerTxt: { fontFamily: 'Raleway_500Medium', fontSize: 18, color: '#333', flexShrink: 1 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 16, marginTop: 10,
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12, backgroundColor: '#fafafa', padding: 8 },
  inputField: { flex: 1, fontSize: 16, fontFamily: 'Raleway_500Medium', paddingRight: 8, maxHeight: 120 },
  sendBtn: { backgroundColor: '#333', borderRadius: 20, width: 34, height: 34,
    justifyContent: 'center', alignItems: 'center' },

  userBubble: { alignSelf: 'flex-end', backgroundColor: '#333', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 12, marginVertical: 4, maxWidth: '80%' },
  bubbleTxt: { fontFamily: 'Raleway_500Medium', fontSize: 16, color: '#fff' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
