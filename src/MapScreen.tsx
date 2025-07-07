/********************************************************************
 * MapScreen.tsx — drawer + dynamic active POI + tag bar + “tap” Easter-egg
 *******************************************************************/
import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  PanResponder,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useFonts, Raleway_500Medium } from '@expo-google-fonts/raleway';

import data from '../content.json';
import { TAG_ICONS } from './tag-icons';

/* ─ constants & helpers ─ */
const { height: SCREEN } = Dimensions.get('window');
const COLLAPSED = SCREEN * 0.25;
const EXPANDED = SCREEN * 0.5;

const TAGS = [
  'All',
  'Art',
  'History',
  'Architecture',
  'Nightlife',
  'Food & Drink',
] as const;
const TAG_FILTER: Record<(typeof TAGS)[number], string[]> = {
  All: [],
  Art: ['artworks'],
  History: ['museums'],
  Architecture: ['architecture'],
  Nightlife: ['bars', 'live'],
  'Food & Drink': ['bars'],
};
const LABEL: Record<string, string> = {
  artworks: 'artwork',
  museums: 'museum',
  architecture: 'piece of architecture',
  bars: 'bar',
  live: 'live venue',
};

const USER = { lat: 58.378, lon: 26.7221 };
const CARD_W = Dimensions.get('window').width - 32;
const m2lonDeg = (m: number, lat: number) =>
  m / (111_320 * Math.cos((lat * Math.PI) / 180));
const isFiniteCoord = (p: { lat: number; lon: number }) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lon);
type Poi = { name: string; lat: number; lon: number; tag: string; desc?: string };

/* ─ OUTER (fonts + loader) ─ */
export default function MapScreen() {
  const [fontsLoaded] = useFonts({ Raleway_500Medium });
  if (!fontsLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <MapScreenInner />;
}

/* ─ INNER component ─ */
function MapScreenInner() {
  const mapRef = useRef<MapView>(null);
  const sheetY = useRef(new Animated.Value(COLLAPSED)).current;

  /* ui state */
  const [cat, setCat] = useState<(typeof TAGS)[number]>('All');
  const [prompt, setPrompt] = useState('');
  const [msgs, setMsgs] = useState<string[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [activeName, setActiveName] = useState<string | undefined>();

  /* NEW — Easter-egg state */
  const [tapSeq, setTapSeq] = useState<string | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapEmoji = () => {
    setTapSeq(prev => (prev ? `${prev} *tap*` : '*tap*\n'));
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => setTapSeq(null), 1200);
  };

  useEffect(() => {
    const id = setTimeout(() => setShowInput(true), 300);
    return () => clearTimeout(id);
  }, []);

  /* dataset & region */
  const all = useMemo(
    () => (data.targets as Poi[]).filter(isFiniteCoord),
    [],
  );
  const { width, height } = Dimensions.get('window');
  const [startR, targetR] = useMemo(() => {
    const φ0 = all.reduce((s, t) => s + t.lat, 0) / all.length;
    const λ0 = all.reduce((s, t) => s + t.lon, 0) / all.length;
    const λΔ = m2lonDeg(700, φ0);
    const φΔ = λΔ * (height / width);
    return [
      {
        latitude: φ0 + φΔ * 0.25,
        longitude: λ0,
        latitudeDelta: 60,
        longitudeDelta: 60,
      },
      {
        latitude: φ0 + φΔ * 0.25,
        longitude: λ0,
        latitudeDelta: φΔ,
        longitudeDelta: λΔ,
      },
    ];
  }, [all, width, height]);

  /* active-card bookkeeping */
  const listH = useRef(0);
  const layouts = useRef<Record<string, { y: number; h: number }>>({});
  const computeActive = useCallback((scrollY = 0) => {
    if (!listH.current) return;
    const mid = scrollY + listH.current / 2;
    for (const [name, { y, h }] of Object.entries(layouts.current)) {
      if (mid >= y && mid <= y + h) {
        setActiveName(name);
        return;
      }
    }
  }, []);

  /* map pins */
  const visible = useMemo(
    () =>
      (cat === 'All'
        ? all
        : all.filter(p => TAG_FILTER[cat].includes(p.tag))
      ).map(p => ({
        ...p,
        selected: !!pois.find(a => a.name === p.name),
        latest: p.name === activeName,
      })),
    [cat, all, pois, activeName],
  );

  /* drawer helpers */
  const animateTo = useCallback(
    (to: number) =>
      Animated.timing(sheetY, {
        toValue: to,
        duration: 250,
        useNativeDriver: false,
      }).start(),
    [sheetY],
  );
  const expand = () => animateTo(0);
  const collapse = () => animateTo(COLLAPSED);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dy) > 10 && Math.abs(g.dx) < 10,
      onPanResponderMove: (_, g) => {
        const newY = Math.min(
          COLLAPSED,
          Math.max(0, sheetY._value + g.dy),
        );
        sheetY.setValue(newY);
      },
      onPanResponderRelease: (_, g) => {
        if (g.vy > 0.25 || g.dy > 50) collapse();
        else if (g.vy < -0.25 || g.dy < -50) expand();
        else sheetY._value < COLLAPSED / 2 ? expand() : collapse();
      },
    }),
  ).current;

  /* actions */
  const focusPoi = (poi: Poi) => {
    setPois(a => [...a.filter(p => p.name !== poi.name), poi]);
    setActiveName(poi.name);
    expand();
  };
  const removePoi = (n: string) => {
    setPois(a => a.filter(p => p.name !== n));
    if (n === activeName) setActiveName(undefined);
  };
  const send = () => {
    const t = prompt.trim();
    if (!t) return;
    setMsgs(m => [...m, t]);
    setPrompt('');
  };

  /* header text */
  const activePoi = activeName
    ? pois.find(p => p.name === activeName)
    : pois[pois.length - 1];
  const header = activePoi
    ? `This seems to be a ${
        LABEL[activePoi.tag] ?? 'place'
      } called:\n${activePoi.name}`
    : 'Oooh, So many interesting places.\nWhere oh where to start…';

  /* ─ render ─ */
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* map */}
      <MemoMap
        ref={mapRef}
        startRegion={startR}
        targetRegion={targetR}
        points={visible}
        onMapPress={collapse}
        onPoiPress={focusPoi}
      />

      {/* drawer */}
      <Animated.View
        style={[styles.drawer, { transform: [{ translateY: sheetY }] }]}
        {...pan.panHandlers}
      >
        {/* tag pills docked to drawer top */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tagBarDock}
          contentContainerStyle={{ paddingLeft: 16 }}
        >
          {TAGS.map(t => {
            const sel = t === cat;
            return (
              <Pressable
                key={t}
                onPress={() => setCat(t)}
                style={[styles.tagPill, sel && styles.tagSel]}
              >
                <Text style={[styles.tagTxt, sel && styles.tagSelTxt]}>
                  {t}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* header row */}
        <Pressable
          onPress={() =>
            sheetY._value < COLLAPSED / 2 ? collapse() : expand()
          }
        >
          <View style={styles.headerRow}>
            {/* emoji now tappable */}
            <Pressable onPress={tapEmoji}>
              <LottieView
                source={require('../assets/lottie_surprise.json')}
                autoPlay
                loop
                style={{ width: 24, height: 24, marginRight: 8 }}
              />
            </Pressable>
            <Text style={styles.headerTxt}>{tapSeq ?? header}</Text>
          </View>
        </Pressable>

        {/* prompt row */}
        {showInput && (
          <View style={styles.promptRow}>
            <TextInput
              style={styles.promptInput}
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

        {/* bubbles + cards */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}
          onLayout={e => {
            listH.current = e.nativeEvent.layout.height;
            computeActive();
          }}
          onScroll={e =>
            computeActive(e.nativeEvent.contentOffset.y)
          }
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {msgs.map((m, i) => (
            <View key={`m-${i}`} style={styles.bubble}>
              <Text style={styles.bubbleTxt}>{m}</Text>
            </View>
          ))}

          {[...pois].reverse().map(p => (
            <View
              key={p.name}
              style={styles.cardWrap}
              onLayout={e => {
                const { y, height } = e.nativeEvent.layout;
                layouts.current[p.name] = { y, h: height };
                computeActive();
              }}
            >
              <Pressable
                onPress={() => removePoi(p.name)}
                style={styles.cardDelete}
                hitSlop={8}
              >
                <Feather name="x" size={16} color="#fff" />
              </Pressable>
              <View style={styles.card}>
                <View style={styles.cardImg}>
                  <Feather
                    name={TAG_ICONS[p.tag] ?? 'map-pin'}
                    size={32}
                    color="#666"
                  />
                </View>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardDesc}>
                  {p.desc ?? 'No description provided.'}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/* ─ DotMarker & MemoMap (unchanged) ─ */
const DotMarker = React.memo(
  ({
    poi,
    selected,
    latest,
    onPress,
  }: {
    poi: Poi;
    selected: boolean;
    latest: boolean;
    onPress: () => void;
  }) => {
    const [tracks, setTracks] = useState(true);
    useEffect(() => {
      setTracks(true);
      const id = setTimeout(() => setTracks(false), 300);
      return () => clearTimeout(id);
    }, [selected, latest]);

    const icon = TAG_ICONS[poi.tag] ?? 'map-pin';
    return (
      <Marker
        coordinate={{ latitude: poi.lat, longitude: poi.lon }}
        onPress={onPress}
        tracksViewChanges={tracks}
      >
        {latest ? (
          <View style={styles.pinLatest}>
            <Feather name={icon} size={18} color="#fff" />
          </View>
        ) : selected ? (
          <View style={styles.pinMedium}>
            <Feather name={icon} size={18} color="#333" />
          </View>
        ) : (
          <View style={styles.pinSmall}>
            <Feather name={icon} size={12} color="#333" />
          </View>
        )}
      </Marker>
    );
  },
);

const MemoMap = React.memo(
  React.forwardRef<MapView, any>(
    (
      { startRegion, targetRegion, points, onMapPress, onPoiPress },
      ref,
    ) => (
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={startRegion}
        moveOnMarkerPress={false}
        onPress={onMapPress}
        onLongPress={onMapPress}
        onPanDrag={onMapPress}
        onMapReady={() =>
          (
            ref as React.RefObject<MapView>
          ).current?.animateToRegion(targetRegion, 1200)
        }
      >
        {points.map((p: any) => (
          <DotMarker
            key={`${p.name}:${p.lat}`}
            poi={p}
            selected={p.selected}
            latest={p.latest}
            onPress={() => onPoiPress(p)}
          />
        ))}
        <Marker coordinate={{ latitude: USER.lat, longitude: USER.lon }} zIndex={999}>
          <View style={styles.userPin}>
            <Feather name="flag" size={18} color="#fff" />
          </View>
        </Marker>
      </MapView>
    ),
  ),
);

/* ─ styles ─ */
const styles = StyleSheet.create({
  tagBarDock: {
    position: 'absolute',
    top: -44,
    left: 0,
    right: 0,
    zIndex: 30,
  },

  tagPill: {
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 10,
  },
  tagSel: { backgroundColor: '#333' },
  tagTxt: { fontFamily: 'Raleway_500Medium', fontSize: 14, color: '#333' },
  tagSelTxt: { color: '#fff' },

  pinSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinMedium: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  pinLatest: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  userPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: EXPANDED,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTxt: {
    fontFamily: 'Raleway_500Medium',
    fontSize: 18,
    color: '#333',
    flex: 1,
  },

  promptRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    padding: 8,
  },
  promptInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Raleway_500Medium',
    paddingRight: 8,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: '#333',
    borderRadius: 20,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },

  bubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#333',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 4,
    maxWidth: '80%',
  },
  bubbleTxt: {
    fontFamily: 'Raleway_500Medium',
    fontSize: 16,
    color: '#fff',
  },

  cardWrap: { marginTop: 20, position: 'relative' },
  cardDelete: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#333',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  card: {
    width: CARD_W,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  cardImg: {
    height: 80,
    backgroundColor: '#eee',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: 'Raleway_500Medium',
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  cardDesc: { fontSize: 14, lineHeight: 20, color: '#555' },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
