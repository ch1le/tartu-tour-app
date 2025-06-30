import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { DEMO_USER } from './constants';
import { useTour } from './hooks/useTour';

const CARD_COLLAPSED = 68;            // ~3-line height
const CARD_EXPANDED  = 220;           // crude full height

export default function MapWithSticky() {
  const tour = useTour(10);
  if (tour.length === 0) return null;                 // data guard

  const [active, setActive] = useState(0);
  const animH = useRef(new Animated.Value(CARD_COLLAPSED)).current;

  /* ---- scroll handler ---- */
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = Math.max(0, e.nativeEvent.contentOffset.y);        // clamp
      const next = Math.min(
        tour.length - 1,
        Math.floor(y / CARD_COLLAPSED)
      );
      if (next !== active) collapseThenExpand(next);
    },
    [active, tour.length]
  );

  const collapseThenExpand = (next: number) => {
    Animated.sequence([
      Animated.timing(animH, { toValue: CARD_COLLAPSED, duration: 120, useNativeDriver: false }),
      Animated.timing(animH, { toValue: CARD_EXPANDED,  duration: 180, useNativeDriver: false }),
    ]).start();
    setActive(next);
  };

  const { width } = Dimensions.get('window');
  const current = tour[active];                        // may be undefined

  return (
    <View style={styles.root}>
      {/* MAP **************************************************** */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: DEMO_USER.lat,
          longitude: DEMO_USER.lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* Pins and route only when data valid */}
        {current && (
          <>
            <Marker
              coordinate={{ latitude: DEMO_USER.lat, longitude: DEMO_USER.lon }}
              title="You"
              pinColor="dodgerblue"
            />
            {tour.map((t, i) => (
              <Marker
                key={i}
                coordinate={{ latitude: t.lat, longitude: t.lon }}
                title={t.name}
                pinColor={i === active ? 'tomato' : 'crimson'}
              />
            ))}
            <Polyline
              coordinates={[
                { latitude: DEMO_USER.lat, longitude: DEMO_USER.lon },
                { latitude: current.lat,    longitude: current.lon },
              ]}
              strokeWidth={4}
              strokeColor="tomato"
            />
          </>
        )}
      </MapView>

      {/* SCROLL VIEW (collapsed cards) ************************** */}
      <ScrollView
        style={styles.scroller}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {tour.map((t, i) => (
          <View key={i} style={[styles.card, { width }]}>
            <Text style={styles.title}>{t.name}</Text>
            <Text style={styles.desc} numberOfLines={3}>
              {t.desc}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* OVERLAY: expanded active card ************************** */}
      {current && (
        <Animated.View
          pointerEvents="none"
          style={[styles.overlay, { height: animH, width }]}
        >
          <Text style={styles.overlayTitle}>{current.name}</Text>
          <Text style={styles.overlayDesc}>{current.desc}</Text>
        </Animated.View>
      )}
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  root: { flex: 1 },

  map: { flex: 0.55 },

  scroller: { flex: 0.45, backgroundColor: '#fff' },

  card: { padding: 16, height: CARD_COLLAPSED },
  title: { fontSize: 16, fontWeight: '600' },
  desc:  { marginTop: 4, color: '#555' },

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fafafa',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  overlayTitle: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  overlayDesc:  { color: '#444' },
});
