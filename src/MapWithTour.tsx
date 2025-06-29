import React, { useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { DEMO_USER } from './constants';
import { useTour } from './hooks/useTour';
import { useViewability } from './hooks/useViewability';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MapWithTour() {
  const tour = useTour(10);
  const {
    activeIndex,
    onViewableItemsChanged,
    viewConfig,
  } = useViewability();
  const active = tour[activeIndex];

  /* bookkeeping to soften (not eliminate) the jump ------------- */
  const listRef   = useRef<FlatList>(null);
  const scrollY   = useRef(0);
  const heights   = useRef<Record<number, number>>({});

  const onScroll = useCallback(e => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const compensate = (diff: number) => {
    listRef.current?.scrollToOffset({
      offset: scrollY.current - diff,
      animated: false,
    });
  };

  return (
    <View style={styles.root}>
      {/* MAP ------------------------------------------------------ */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: DEMO_USER.lat,
          longitude: DEMO_USER.lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{ latitude: DEMO_USER.lat, longitude: DEMO_USER.lon }}
          title="You (demo)"
          pinColor="dodgerblue"
        />
        {tour.map((t, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: t.lat, longitude: t.lon }}
            title={t.name}
            description={t.desc}
            pinColor={i === activeIndex ? 'tomato' : 'crimson'}
          />
        ))}
        {active && (
          <Polyline
            coordinates={[
              { latitude: DEMO_USER.lat, longitude: DEMO_USER.lon },
              { latitude: active.lat, longitude: active.lon },
            ]}
            strokeWidth={4}
            strokeColor="tomato"
          />
        )}
      </MapView>

      {/* LIST ----------------------------------------------------- */}
      <FlatList
        ref={listRef}
        data={tour}
        keyExtractor={(_, i) => String(i)}
        style={styles.list}
        extraData={activeIndex}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        renderItem={({ item, index }) => {
          const isActive   = index === activeIndex;
          const isExpanded = isActive;

          return (
            <View
              style={[
                styles.card,
                isActive && styles.cardActive,
              ]}
              onLayout={e => {
                const h = e.nativeEvent.layout.height;
                if (isActive && !heights.current[index]) {
                  heights.current[index] = h;  // store full height
                }
              }}
            >
              <Text
                style={[
                  styles.title,
                  isActive && styles.titleActive,
                ]}
              >
                {item.name}
              </Text>

              <Text
                style={styles.desc}
                numberOfLines={isExpanded ? undefined : 3}
                onTextLayout={e => {
                  if (!isExpanded) {
                    const full = heights.current[index];
                    const collapsed = e.nativeEvent.lines.length
                      ? e.nativeEvent.lines
                          .slice(0, 3)
                          .reduce((s, l) => s + l.height, 0) + 8
                      : undefined;

                    if (full && collapsed && full > collapsed) {
                      const diff = full - collapsed;
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut
                      );
                      compensate(diff);
                      heights.current[index] = collapsed;
                    }
                  }
                }}
              >
                {item.desc}
              </Text>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

/* ----------------- styles ----------------- */
const styles = StyleSheet.create({
  root: { flex: 1 },

  map:  { flex: 0.55 },
  list: { flex: 0.45, backgroundColor: '#fff' },

  card:       { padding: 16 },
  cardActive: { backgroundColor: '#fafafa' },

  title:       { fontSize: 16, fontWeight: '600' },
  titleActive: { fontSize: 18 },

  desc: { marginTop: 4, color: '#246BFD' },
  sep:  { height: 1, backgroundColor: '#eee' },
});
