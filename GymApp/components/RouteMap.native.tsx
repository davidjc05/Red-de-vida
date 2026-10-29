// Versión NATIVA (iOS/Android): mapa real con react-native-maps.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { Colors } from '../constants/colors';

const { width } = Dimensions.get('window');

type Coord = { latitude: number; longitude: number };

// Punto de inicio / posición actual. Cada marcador deja de "trackear" su vista a los 600 ms:
// en Android, si no, los marcadores personalizados consumen CPU y pueden parpadear.
function Dot({ coordinate, color, size }: { coordinate: Coord; color: string; size: number }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, borderWidth: 2, borderColor: '#FFFFFF',
      }} />
    </Marker>
  );
}

export default function RouteMap({ coords, isDark }: { coords: Coord[]; isDark: boolean }) {
  const W = width - 72;
  const H = 200;
  const bg = isDark ? '#111111' : '#F2F5EE';
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !mapRef.current || coords.length === 0) return;
    if (coords.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }, 0);
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 30, right: 30, bottom: 30, left: 30 },
        animated: false,
      });
    }
  }, [coords, ready]);

  if (coords.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: bg, width: W, height: H }]}>
        <Text style={{ color: isDark ? '#A1A1A0' : '#5F5E5A', fontSize: 13, fontFamily: 'Barlow-Regular' }}>
          Iniciando GPS...
        </Text>
      </View>
    );
  }

  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <View style={{ width: W, height: H, borderRadius: 12, overflow: 'hidden', backgroundColor: bg }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: last.latitude,
          longitude: last.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        onMapReady={() => setReady(true)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        {coords.length >= 2 && (
          <Polyline
            coordinates={coords}
            strokeColor={Colors.primary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {coords.length >= 2 && <Dot coordinate={first} color={isDark ? '#A1A1A0' : '#5F5E5A'} size={14} />}
        <Dot coordinate={last} color={Colors.primary} size={18} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
