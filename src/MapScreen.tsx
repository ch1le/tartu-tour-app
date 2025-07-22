/********************************************************************
 * MapScreen.tsx — v78.2
 *  · Flips on double‑tap or fast horizontal swipe only.
 *  · Visible 3‑D flip animation (JS driver).
 *  · Heart button toggles likes without flipping.
 *  · Map mounts 300 ms into flip to avoid zoom glitch.
 *******************************************************************/
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Pressable,         // ← added
  ScrollView,        // ← added
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import {
  TapGestureHandler,
  PanGestureHandler,
  State as GHState,
} from 'react-native-gesture-handler';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import data from '../content.json';
import { images } from './assetMap';
/* ─ constants ─ */
const { width: SCREEN_W } = Dimensions.get('window');
const YELLOW       = '#ffeb3b';
const PINK         = '#ff4d9d';
const PINK_ACTIVE  = '#e73886';
const USER = { lat: 39.48605, lon: -0.360325 };

const MAIN_CATS = ['History', 'Food', 'Nature', 'Culture', 'Local Commerce'] as const;
type MainCat = (typeof MAIN_CATS)[number];
const ICONS: Record<MainCat, keyof typeof Feather.glyphMap> = {
  History: 'book-open',
  Food: 'coffee',
  Nature: 'leaf',
  Culture: 'camera',
  'Local Commerce': 'shopping-bag',
};

/* POI type & dataset */
interface Poi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: MainCat;
  desc?: string;
  tags: string[];
  imageKey?: string;
}
const POIS: Poi[] = (data.targets as any[]).map((t: any, i: number) => ({
  id: `${t.lat},${t.lon},${i}`,
  name: t.name,
  lat: t.lat,
  lon: t.lon,
  category: (Array.isArray(t.categories) && t.categories[0] ? t.categories[0] : 'Culture') as MainCat,
  desc: t.desc,
  tags: Array.isArray(t.tags) ? t.tags : [],
  imageKey: t.imageKey,
}));

/* helpers */
const walkTime = (m: number) => {
  const mins = Math.round(m / 83.33);
  return mins < 1 ? '<1 min' : `${mins} min`;
};
const getRegion = (poi: Poi): Region => {
  const latSpan = Math.max(Math.abs(poi.lat - USER.lat) * 2, 0.005);
  const lonSpan = Math.max(Math.abs(poi.lon - USER.lon) * 2, 0.005);
  return {
    latitude: USER.lat,
    longitude: USER.lon,
    latitudeDelta: latSpan * 1.4,
    longitudeDelta: lonSpan * 1.4,
  };
};

/* ─ main screen ─ */
export default function MapScreen() {
  const [selectedCats, setSelectedCats] = useState<Set<MainCat>>(new Set());
  const [subTag, setSubTag] = useState<string | null>(null);
  const [liked, setLiked] = useState<Poi[]>([]);
  const [likedFilter, setLikedFilter] = useState(false);
  const [filterH, setFilterH] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  /* counts & filtering */
  const mainCounts = useMemo<Record<MainCat, number>>(() => {
    const m = { History: 0, Food: 0, Nature: 0, Culture: 0, 'Local Commerce': 0 };
    POIS.forEach((p) => { m[p.category] += 1; });
    return m;
  }, []);

  const secondaryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (!selectedCats.size) return m;
    POIS.filter((p) => selectedCats.has(p.category))
        .forEach((p) => p.tags.forEach((t) => { m[t] = (m[t] || 0) + 1; }));
    return m;
  }, [selectedCats]);

  const vibeTags = useMemo(
    () => Object.keys(secondaryCounts).sort((a, b) => secondaryCounts[b] - secondaryCounts[a]),
    [secondaryCounts],
  );

  const visible = useMemo(() => {
    const base = likedFilter ? liked : POIS;
    return base.filter((p) => (
      (!selectedCats.size || selectedCats.has(p.category)) &&
      (!subTag || p.tags.includes(subTag))
    ));
  }, [selectedCats, subTag, liked, likedFilter]);

  const toggleCat = (c: MainCat) => setSelectedCats((prev) => {
    const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c);
    if (!n.has(c)) setSubTag(null);
    return n;
  });
  const toggleLike = (poi: Poi) => setLiked((arr) => (
    arr.some((p) => p.id === poi.id) ? arr.filter((p) => p.id !== poi.id) : [...arr, poi]
  ));

  /* ─ Card ─ */
  const Card = memo(({ poi }: { poi: Poi }) => {
    const isLiked = liked.some((p) => p.id === poi.id);
    const flip = useRef(new Animated.Value(poi.id === flippedId ? 180 : 0)).current;
    const isFlipped = poi.id === flippedId;

    const [cardH, setCardH] = useState(220);
    const [showMap, setShowMap] = useState(false);

    useEffect(() => {
      Animated.timing(flip, {
        toValue: isFlipped ? 180 : 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,       // JS driver → visible on all devices
      }).start();

      if (isFlipped) {
        const id = setTimeout(() => setShowMap(true), 300);
        return () => clearTimeout(id);
      }
      setShowMap(false);
    }, [isFlipped]);

    const frontDeg = flip.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
    const backDeg  = flip.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });

    const meters = Math.hypot((poi.lat - USER.lat) * 111000, (poi.lon - USER.lon) * 85000);
    const dist   = walkTime(meters);

    /* gesture refs & handlers */
    const heartRef = useRef<TapGestureHandler>(null);
    const onDoubleTap = ({ nativeEvent }: any) => {
      if (nativeEvent.state === GHState.ACTIVE) setFlippedId(isFlipped ? null : poi.id);
    };
    const onSwipeEnd = ({ nativeEvent }: any) => {
      if (nativeEvent.state === GHState.END && Math.abs(nativeEvent.velocityX) > 300) {
        setFlippedId(isFlipped ? null : poi.id);
      }
    };

    return (
      <PanGestureHandler
        activeOffsetX={[-25, 25]}
        failOffsetY={[-10, 10]}
        onHandlerStateChange={onSwipeEnd}
      >
        <TapGestureHandler
          numberOfTaps={2}
          waitFor={heartRef}
          onHandlerStateChange={onDoubleTap}
        >
          <Animated.View style={styles.cardOuter}>
            {/* FRONT */}
            <Animated.View
              style={[styles.card, { transform: [{ perspective: 800 }, { rotateY: frontDeg }] }]}
              onLayout={(e) => setCardH(Math.max(220, e.nativeEvent.layout.height))}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.distChip}>
                  <MaterialCommunityIcons name="walk" size={16} color="#333" />
                  <Text style={styles.distTxt}>~{dist}</Text>
                </View>
                <Text style={styles.cardTitle}>{poi.name}</Text>

                <TapGestureHandler
                  ref={heartRef}
                  onHandlerStateChange={({ nativeEvent }) => {
                    if (nativeEvent.state === GHState.ACTIVE) toggleLike(poi);
                  }}
                >
                  <Animated.View style={styles.heartChip}>
                    <MaterialCommunityIcons name={isLiked ? 'heart' : 'heart-outline'} size={14} color="#fff" />
                  </Animated.View>
                </TapGestureHandler>
              </View>

              {poi.imageKey && images[poi.imageKey] ? (
                <View style={styles.imgRow}>
                  <Image source={images[poi.imageKey]} style={styles.cardImg} />
                  <View style={styles.cardTagCol}>
                    <View style={styles.cardCatPill}>
                      <Feather name={ICONS[poi.category]} size={12} color="#333" style={{ marginRight: 4 }} />
                      <Text style={styles.cardCatTxt}>{poi.category}</Text>
                    </View>
                    {poi.tags.map((t) => (
                      <View key={t} style={styles.cardTagPill}>
                        <Text style={styles.cardTagTxt}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.cardTagRow}>
                  <View style={styles.cardCatPill}>
                    <Feather name={ICONS[poi.category]} size={12} color="#333" style={{ marginRight: 4 }} />
                    <Text style={styles.cardCatTxt}>{poi.category}</Text>
                  </View>
                  {poi.tags.map((t) => (
                    <View key={t} style={styles.cardTagPill}>
                      <Text style={styles.cardTagTxt}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.cardDesc}>{poi.desc || 'No description provided.'}</Text>
            </Animated.View>

            {/* BACK */}
            <Animated.View
              style={[
                styles.card,
                styles.cardBack,
                { height: cardH, transform: [{ perspective: 800 }, { rotateY: backDeg }] },
              ]}
            >
              {showMap && (
                <MapView
                  key={`map-${poi.id}`}
                  style={StyleSheet.absoluteFillObject}
                  region={getRegion(poi)}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={{ latitude: USER.lat, longitude: USER.lon }} pinColor="#000" />
                  <Marker coordinate={{ latitude: poi.lat, longitude: poi.lon }} pinColor={YELLOW} />
                  {liked.map((p) => (
                    <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lon }} pinColor={PINK} />
                  ))}
                </MapView>
              )}
            </Animated.View>
          </Animated.View>
        </TapGestureHandler>
      </PanGestureHandler>
    );
  });

  /* ─ Filter bar ─ */
  const FilterBar = () => (
    <View style={styles.filterContainer} onLayout={(e) => setFilterH(e.nativeEvent.layout.height)}>
      <View style={styles.vibeLabelRow}>
        <Feather
          name={selectedCats.size ? 'arrow-up' : 'arrow-down'}
          size={12}
          color="#333"
          style={{ marginRight: 4 }}
        />
        <Text style={styles.vibeLabelTxt}>
          {selectedCats.size ? 'What vibe are you looking for?' : 'What are you interested in?'}
        </Text>
      </View>

      <View style={[styles.mainBarWrap, styles.tagScroll, styles.mainBar]}>
        {MAIN_CATS.map((cat) => {
          const sel = selectedCats.has(cat);
          return (
            <Pressable key={cat} style={[styles.tagPill, sel && styles.tagSel]} onPress={() => toggleCat(cat)}>
              <Feather name={ICONS[cat]} size={14} color={sel ? '#fff' : '#333'} style={{ marginRight: 4 }} />
              <Text style={[styles.tagTxt, sel && styles.tagSelTxt]}>
                {cat} ({mainCounts[cat]})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedCats.size > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagScroll}
          style={styles.subBar}
        >
          {vibeTags.map((tag) => {
            const sel = tag === subTag;
            return (
              <Pressable key={tag} style={[styles.tagPill, sel && styles.tagSel]} onPress={() => setSubTag(sel ? null : tag)}>
                <Text style={[styles.tagTxt, sel && styles.tagSelTxt]}>
                  {tag} ({secondaryCounts[tag]})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {liked.length > 0 && (
        <Pressable style={[styles.likedBadge, likedFilter && styles.likedBadgeActive]} onPress={() => setLikedFilter((p) => !p)}>
          <MaterialCommunityIcons name="heart" size={12} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.likedTxt}>Liked places ({liked.length})</Text>
        </Pressable>
      )}
    </View>
  );

  /* ─ render ─ */
  return (
    <View style={styles.container}>
      <FilterBar />
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingTop: filterH + 8, paddingBottom: 24 }}
        renderItem={({ item }) => <Card poi={item} />}
      />
    </View>
  );
}

/* ─ styles ─ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  filterContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 4,
    zIndex: 100,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tagScroll: { paddingHorizontal: 12 },
  mainBar: { marginTop: 2 },
  subBar: { marginBottom: 4 },
  mainBarWrap: { flexDirection: 'row', flexWrap: 'wrap' },

  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 5,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  tagSel: { backgroundColor: '#333' },
  tagTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },
  tagSelTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#fff' },

  vibeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: YELLOW,
    borderRadius: 6,
    marginBottom: 2,
  },
  vibeLabelTxt: { fontSize: 16, fontFamily: 'Raleway', color: '#333' },

  likedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: PINK,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  likedBadgeActive: { backgroundColor: PINK_ACTIVE },
  likedTxt: { fontSize: 14, fontFamily: 'Raleway', color: '#fff' },

  cardOuter: { marginHorizontal: 16, marginBottom: 16, width: SCREEN_W - 32 },
  card: {
    minHeight: 220,
    backfaceVisibility: 'hidden',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardBack: { position: 'absolute', top: 0, left: 0, right: 0, padding: 0 },

  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  distChip: { flexDirection: 'column', alignItems: 'center', marginRight: 8 },
  distTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: 'Raleway-Bold', color: '#333', marginRight: 8 },
  heartChip: { width: 30, height: 30, borderRadius: 15, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center' },

  imgRow: { flexDirection: 'row', marginBottom: 8 },
  cardImg: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  cardTagCol: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cardTagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },

  cardCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  cardCatTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },
  cardTagPill: {
    backgroundColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  cardTagTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },

  cardDesc: { fontSize: 14, lineHeight: 22, fontFamily: 'Raleway', color: '#555' },
});
