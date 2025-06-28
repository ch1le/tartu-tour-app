import { StyleSheet, View, Text, FlatList } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTour } from './hooks/useTour';
import { useViewableIndex } from './hooks/useViewableIndex';
import { DEMO_USER } from './constants';

export default function MapWithTour() {
  const tour           = useTour(10);                      // ≤ 10 POIs
  const { index,
          onViewableItemsChanged,
          viewConfig }  = useViewableIndex();
  const active         = tour[index];

  return (
    <View style={styles.root}>
      {/* -- MAP ----------------------------------------------------- */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude:  DEMO_USER.lat,
          longitude: DEMO_USER.lon,
          latitudeDelta:  0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* you (demo) */}
        <Marker
          coordinate={{ latitude: DEMO_USER.lat,
                        longitude: DEMO_USER.lon }}
          title="You (demo)"
          pinColor="dodgerblue"
        />

        {/* POI pins */}
        {tour.map((t, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: t.lat, longitude: t.lon }}
            title={t.name}
            description={t.desc}
            pinColor={i === index ? 'tomato' : 'crimson'}
          />
        ))}

        {/* straight line from you → active */}
        {active && (
          <Polyline
            coordinates={[
              { latitude: DEMO_USER.lat, longitude: DEMO_USER.lon },
              { latitude: active.lat,   longitude: active.lon   },
            ]}
            strokeWidth={4}
            strokeColor="tomato"
          />
        )}
      </MapView>

      {/* -- LIST --------------------------------------------------- */}
      <FlatList
        data={tour}
        keyExtractor={(_, i) => String(i)}
        style={styles.list}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name}</Text>
            <Text numberOfLines={3} style={styles.desc}>
              {item.desc}
            </Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map:  { flex: 0.55 },
  list: { flex: 0.45, backgroundColor: '#fff' },
  card: { padding: 16 },
  title:{ fontSize: 16, fontWeight: '600' },
  desc: { marginTop: 4, color: '#555' },
  sep:  { height: 1, backgroundColor: '#eee' },
});
