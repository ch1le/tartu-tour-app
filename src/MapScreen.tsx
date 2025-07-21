/********************************************************************
 * MapScreen.tsx — v67
 *  • Tap the pink “Liked places” badge to toggle show‑only‑liked pins.
 *  • Tag bars remain visible while the filter is active.
 *******************************************************************/
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import data from '../content.json';
import { images } from './assetMap';

/* ─ configuration ─ */
const CARD_ACCENT_BG = true;
const USER = { lat: 39.48605, lon: -0.360325 };
const WIDTH_METERS = 700;
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_H * 0.5;
const CARD_OFFSET_FRAC = 0.25;
const CLAMP_MARGIN_PX = 16;
const YELLOW = '#ffeb3b';
const PINK = '#ff4d9d';
const PINK_ACTIVE = '#e73886';

/* categories */
const MAIN_CATS = ['History', 'Food', 'Nature', 'Culture', 'Local Commerce'] as const;
type MainCat = (typeof MAIN_CATS)[number];
const CATEGORY_ICONS: Record<MainCat, keyof typeof Feather.glyphMap> = {
  History: 'book-open',
  Food: 'coffee',
  Nature: 'leaf',
  Culture: 'camera',
  'Local Commerce': 'shopping-bag',
};

/* dataset */
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

const m2lonDeg = (m: number, lat: number) =>
  m / (111_320 * Math.cos((lat * Math.PI) / 180));

const POIS: Poi[] = (data.targets as any[]).map((t: any, i: number) => ({
  id: `${t.lat},${t.lon},${i}`,
  name: t.name,
  lat: t.lat,
  lon: t.lon,
  category: (Array.isArray(t.categories) && t.categories[0]
    ? t.categories[0]
    : 'Culture') as MainCat,
  desc: t.desc,
  tags: Array.isArray(t.tags) ? t.tags : [],
  imageKey: t.imageKey,
})).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));

const computeRegion = (): Region => {
  const lonΔ = m2lonDeg(WIDTH_METERS, USER.lat);
  return {
    latitude: USER.lat,
    longitude: USER.lon,
    latitudeDelta: lonΔ * (SCREEN_H / SCREEN_W),
    longitudeDelta: lonΔ,
  };
};

/* helpers */
const distMeters = (la1: number, lo1: number, la2: number, lo2: number) => {
  const R = 6_371_000;
  const φ1 = (la1 * Math.PI) / 180;
  const φ2 = (la2 * Math.PI) / 180;
  const dφ = ((la2 - la1) * Math.PI) / 180;
  const dλ = ((lo2 - lo1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2
    + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const walkTime = (m: number) => {
  const mins = Math.round(m / 83.33); // ≈5 km/h
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
};

const clampToBox = (lat: number, lon: number, box: Region) => {
  const latMar = box.latitudeDelta * (CLAMP_MARGIN_PX / SCREEN_H);
  const lonMar = box.longitudeDelta * (CLAMP_MARGIN_PX / SCREEN_W);
  const latMin = box.latitude - box.latitudeDelta / 2 + latMar;
  const latMax = box.latitude + box.latitudeDelta / 2 - latMar;
  const lonMin = box.longitude - box.longitudeDelta / 2 + lonMar;
  const lonMax = box.longitude + box.longitudeDelta / 2 - lonMar;
  if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) return null;
  return {
    lat: Math.max(Math.min(lat, latMax), latMin),
    lon: Math.max(Math.min(lon, lonMax), lonMin),
  };
};

/* ─ Pin component ─ */
const DotMarker = memo(
  ({
    poi, selected, visited, liked, edge, filterOn, onPress,
  }: {
    poi: Poi;
    selected: boolean;
    visited: boolean;
    liked: boolean;
    edge: boolean;
    filterOn: boolean;
    onPress: () => void;
  }) => {
    const [tracks, setTracks] = useState(true);
    useEffect(() => {
      setTracks(true);
      const id = setTimeout(() => setTracks(false), 300);
      return () => clearTimeout(id);
    }, [selected, edge, visited, liked, filterOn]);

    let base = styles.pinSmall;
    if (selected && liked) base = styles.pinSelectedLiked;
    else if (selected) base = styles.pinSelected;
    else if (liked) base = styles.pinLiked;
    else if (visited) base = styles.pinVisited;
    else if (edge) base = styles.pinEdge;
    else if (filterOn) base = styles.pinFilter;

    const iconColor = selected
      ? '#333'
      : liked
        ? '#fff'
        : visited
          ? '#333'
          : filterOn && !edge
            ? '#fff'
            : edge ? '#666' : '#333';

    const size = selected || visited ? 18 : 14;

    return (
      <Marker coordinate={{ latitude: poi.lat, longitude: poi.lon }} title={poi.name} tracksViewChanges={tracks} onPress={onPress}>
        <View style={base}>
          <Feather name={CATEGORY_ICONS[poi.category]} size={size} color={iconColor} />
        </View>
      </Marker>
    );
  },
);

/* ─ Main component ─ */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const regionRef = useRef<Region | null>(null);

  const [viewRegion, setViewRegion] = useState<Region | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<MainCat>>(new Set());
  const [subTag, setSubTag] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visited, setVisited] = useState<Poi[]>([]);
  const [liked, setLiked] = useState<Poi[]>([]);
  const [likedFilter, setLikedFilter] = useState(false);

  /* static counts */
  const mainCounts = useMemo(() => {
    const m: Record<MainCat, number> = {
      History: 0, Food: 0, Nature: 0, Culture: 0, 'Local Commerce': 0,
    };
    POIS.forEach((p) => { m[p.category] += 1; });
    return m;
  }, []);

  const toggleCat = (cat: MainCat) => setSelectedCats((prev) => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    if (!next.has(cat)) setSubTag(null);
    return next;
  });

  /* regions */
  const [startRegion, targetRegion] = useMemo(() => {
    const r = computeRegion();
    return [
      { ...r, latitudeDelta: r.latitudeDelta * 5, longitudeDelta: r.longitudeDelta * 5 },
      r,
    ];
  }, []);

  const withinTarget = (p: Poi) => {
    const latMin = targetRegion.latitude - targetRegion.latitudeDelta / 2;
    const latMax = targetRegion.latitude + targetRegion.latitudeDelta / 2;
    const lonMin = targetRegion.longitude - targetRegion.longitudeDelta / 2;
    const lonMax = targetRegion.longitude + targetRegion.longitudeDelta / 2;
    return p.lat >= latMin && p.lat <= latMax && p.lon >= lonMin && p.lon <= lonMax;
  };

  /* visible POIs */
  const visible = useMemo(() => {
    if (likedFilter) return liked;
    let base: Poi[];
    if (selectedCats.size === 0) {
      const sample: Poi[] = [];
      MAIN_CATS.forEach((cat) => {
        if (sample.length >= 15) return;
        const subset = POIS.filter((p) => p.category === cat && withinTarget(p));
        sample.push(...subset.slice(0, 3));
      });
      if (sample.length < 15) {
        sample.push(...POIS.filter((p) => withinTarget(p) && !sample.includes(p))
          .slice(0, 15 - sample.length));
      }
      base = sample;
    } else {
      base = POIS.filter(
        (p) => selectedCats.has(p.category) && (!subTag || p.tags.includes(subTag)),
      );
    }
    return [...base, ...liked].filter(
      (p, i, arr) => arr.findIndex((q) => q.id === p.id) === i,
    );
  }, [selectedCats, subTag, liked, likedFilter]);

  /* vibe counts */
  const secondaryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    if (selectedCats.size === 0) return m;
    POIS.filter((p) => selectedCats.has(p.category)).forEach((p) => {
      p.tags.forEach((t) => { m[t] = (m[t] || 0) + 1; });
    });
    return m;
  }, [selectedCats]);

  const vibeTags = useMemo(
    () => Object.keys(secondaryCounts).sort((a, b) => secondaryCounts[b] - secondaryCounts[a]),
    [secondaryCounts],
  );

  /* keep selection valid */
  useEffect(() => { if (subTag && !secondaryCounts[subTag]) setSubTag(null); }, [subTag, secondaryCounts]);
  useEffect(() => { if (selectedId && !visible.find((p) => p.id === selectedId)) setSelectedId(null); }, [visible, selectedId]);
  const selectedPoi = useMemo(() => visible.find((p) => p.id === selectedId) || null, [selectedId, visible]);

  /* clamp pins */
  const markers = useMemo(() => {
    if (!viewRegion || visible.length >= 15) return visible.map((p) => ({ ...p, edge: false }));
    return visible.map((p) => {
      const c = clampToBox(p.lat, p.lon, viewRegion);
      return c ? { ...p, ...c, edge: true } : { ...p, edge: false };
    });
  }, [visible, viewRegion]);

  /* helpers */
  const centerOn = (poi: Poi) => {
    if (!regionRef.current || !mapRef.current) return;
    const r = regionRef.current;
    mapRef.current.animateToRegion(
      { ...r, latitude: poi.lat - r.latitudeDelta * CARD_OFFSET_FRAC, longitude: poi.lon },
      300,
    );
  };

  const handleSelect = (poi: Poi) => {
    setSelectedId(poi.id);
    centerOn(poi);
    setVisited((prev) => (prev.find((p) => p.id === poi.id) ? prev : [...prev, poi]));
  };

  const toggleLike = (poi: Poi) => setLiked((prev) => {
    const has = prev.some((p) => p.id === poi.id);
    return has ? prev.filter((p) => p.id !== poi.id) : [...prev, poi];
  });

  const isLiked = selectedPoi ? liked.some((p) => p.id === selectedPoi.id) : false;
  const filterOn = selectedCats.size > 0;
  const tagsHidden = !!selectedPoi;
  const selWalk = useMemo(() => selectedPoi ? walkTime(distMeters(USER.lat, USER.lon, selectedPoi.lat, selectedPoi.lon)) : null, [selectedPoi]);

  /* liked badge */
  const likedBadge = liked.length > 0 && (
    <Pressable
      style={[
        styles.likedBadge,
        likedFilter && styles.likedBadgeActive,
      ]}
      onPress={() => setLikedFilter((prev) => !prev)}
    >
      <MaterialCommunityIcons name="heart" size={12} color="#fff" style={{ marginRight: 4 }} />
      <Text style={styles.likedTxt}>Liked places ({liked.length})</Text>
    </Pressable>
  );

  /* ---- render ---- */
  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={startRegion}
        onMapReady={() => mapRef.current?.animateToRegion(targetRegion, 1200)}
        onPress={() => setSelectedId(null)}
        onRegionChange={(r) => { setViewRegion(r); regionRef.current = r; }}
      >
        {markers.map((p) => (
          <DotMarker
            key={p.id}
            poi={p}
            selected={p.id === selectedId}
            visited={!!visited.find((v) => v.id === p.id)}
            liked={!!liked.find((v) => v.id === p.id)}
            edge={(p as any).edge}
            filterOn={filterOn}
            onPress={() => handleSelect(p)}
          />
        ))}

        <Marker coordinate={{ latitude: USER.lat, longitude: USER.lon }} pinColor="black" zIndex={10000} />
      </MapView>

      {/* floating liked badge (when card open) */}
      {selectedPoi && likedBadge && <View style={styles.likedFloating}>{likedBadge}</View>}

      {/* bottom tag panel */}
      {!tagsHidden && (
        <View style={[styles.bottomPanel, { bottom: 0, paddingBottom: 48 }]}>
          {!selectedPoi && likedBadge}

          {selectedCats.size > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll} style={styles.subBar}>
              {vibeTags.map((tag) => {
                const sel = tag === subTag;
                return (
                  <Pressable key={tag} style={[styles.tagPill, sel && styles.tagSel]} onPress={() => setSubTag(sel ? null : tag)}>
                    <Text style={[styles.tagTxt, sel && styles.tagSelTxt]}>{tag} ({secondaryCounts[tag]})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.vibeLabelRow}>
            <Feather name={selectedCats.size > 0 ? 'arrow-up' : 'arrow-down'} size={12} color="#333" style={{ marginRight: 4 }} />
            <Text style={styles.vibeLabelTxt}>
              {selectedCats.size > 0 ? 'What vibe are you looking for?' : 'What are you interested in?'}
            </Text>
          </View>

          <View style={[styles.mainBarWrap, styles.tagScroll, styles.mainBar]}>
            {MAIN_CATS.map((cat) => {
              const sel = selectedCats.has(cat);
              return (
                <Pressable key={cat} style={[styles.tagPill, sel && styles.tagSel]} onPress={() => toggleCat(cat)}>
                  <Feather name={CATEGORY_ICONS[cat]} size={14} color={sel ? '#fff' : '#333'} style={{ marginRight: 4 }} />
                  <Text style={[styles.tagTxt, sel && styles.tagSelTxt]}>
                    {cat} ({mainCounts[cat]})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* info card */}
      {selectedPoi && (
        <View style={styles.cardWrapper}>
          <View style={styles.cardHeaderRow}>
            {selWalk && (
              <View style={styles.distChip}>
                <MaterialCommunityIcons name="walk" size={16} color="#333" />
                <Text style={styles.distTxt}>~{selWalk}</Text>
              </View>
            )}
            <Text style={styles.cardTitle} numberOfLines={2}>{selectedPoi.name}</Text>
            <View style={styles.cardActionsRow}>
              <Pressable style={styles.walkChip}>
                <Feather name="navigation" size={14} color="#333" />
                <Text style={styles.walkTxt}>Walk here</Text>
              </Pressable>
              <Pressable style={styles.heartChip} onPress={() => toggleLike(selectedPoi)}>
                <MaterialCommunityIcons name={isLiked ? 'heart' : 'heart-outline'} size={14} color="#fff" />
              </Pressable>
              <Pressable style={styles.closeChip} onPress={() => setSelectedId(null)}>
                <Text style={styles.removeTxt}>×</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.descScroll} contentContainerStyle={{ paddingBottom: 8 }}>
            {selectedPoi.imageKey && images[selectedPoi.imageKey] ? (
              <View style={styles.imgRow}>
                <Image source={images[selectedPoi.imageKey]} style={styles.cardImg} />
                <View style={styles.cardTagCol}>
                  <View style={styles.cardCatPill}>
                    <Feather name={CATEGORY_ICONS[selectedPoi.category]} size={12} color="#333" style={{ marginRight: 4 }} />
                    <Text style={styles.cardCatTxt}>{selectedPoi.category}</Text>
                  </View>
                  {selectedPoi.tags.map((t) => (
                    <View key={t} style={styles.cardTagPill}>
                      <Text style={styles.cardTagTxt}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.cardTagRow}>
                <View style={styles.cardCatPill}>
                  <Feather name={CATEGORY_ICONS[selectedPoi.category]} size={12} color="#333" style={{ marginRight: 4 }} />
                  <Text style={styles.cardCatTxt}>{selectedPoi.category}</Text>
                </View>
                {selectedPoi.tags.map((t) => (
                  <View key={t} style={styles.cardTagPill}>
                    <Text style={styles.cardTagTxt}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.cardDesc}>{selectedPoi.desc || 'No description provided.'}</Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ─ styles ─ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  /* pins */
  pinSmall: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  pinVisited: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  pinSelected: { width: 30, height: 30, borderRadius: 15, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center' },
  pinSelectedLiked: { width: 30, height: 30, borderRadius: 15, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: PINK },
  pinEdge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#999' },
  pinFilter: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#000' },
  pinLiked: { width: 22, height: 22, borderRadius: 11, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: PINK },

  /* tag rows */
  bottomPanel: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 12 },
  tagScroll: { paddingHorizontal: 12 },
  mainBar: { marginTop: 2 },
  subBar: { marginBottom: 4 },
  mainBarWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  tagPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 5, marginBottom: 2, borderWidth: 1, borderColor: '#000' },
  tagSel: { backgroundColor: '#333' },
  tagTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },
  tagSelTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#fff' },

  vibeLabelRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: YELLOW, borderRadius: 6, marginBottom: 2 },
  vibeLabelTxt: { fontSize: 16, fontFamily: 'Raleway', color: '#333' },

  /* liked badge */
  likedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: PINK, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 6 },
  likedBadgeActive: { backgroundColor: PINK_ACTIVE },
  likedTxt: { fontSize: 14, fontFamily: 'Raleway', color: '#fff' },
  likedFloating: { position: 'absolute', left: 12, bottom: CARD_HEIGHT + 12, zIndex: 1000 },

  /* card */
  cardWrapper: { position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_HEIGHT, backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: -3 } },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  distChip: { flexDirection: 'column', alignItems: 'center', marginRight: 8 },
  distTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: 'Raleway-Bold', color: '#333', marginRight: 8 },
  cardActionsRow: { flexDirection: 'row', alignItems: 'center' },

  walkChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: YELLOW, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8 },
  walkTxt: { fontSize: 14, fontFamily: 'Raleway', color: '#333', marginLeft: 4 },

  heartChip: { width: 30, height: 30, borderRadius: 15, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  closeChip: { backgroundColor: '#f0f0f0', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  removeTxt: { fontSize: 18, lineHeight: 18, fontFamily: 'Raleway', color: '#333' },

  cardTagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  imgRow: { flexDirection: 'row', marginBottom: 8 },
  cardImg: { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  cardTagCol: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cardCatPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_ACCENT_BG ? '#f0f0f0' : 'transparent', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6 },
  cardCatTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },
  cardTagPill: { backgroundColor: CARD_ACCENT_BG ? '#eee' : 'transparent', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6 },
  cardTagTxt: { fontSize: 12, fontFamily: 'Raleway', color: '#333' },

  descScroll: { flex: 1 },
  cardDesc: { fontSize: 14, lineHeight: 22, fontFamily: 'Raleway', color: '#555' },
});
