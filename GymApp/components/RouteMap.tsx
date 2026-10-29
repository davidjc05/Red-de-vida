// Versión WEB del mapa: react-native-maps no funciona en web, así que se dibuja la ruta en SVG.
// En iOS/Android Metro usa automáticamente RouteMap.native.tsx (mapa real).
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { Colors } from '../constants/colors';

const { width } = Dimensions.get('window');

type Coord = { latitude: number; longitude: number };

export default function RouteMap({ coords, isDark }: { coords: Coord[]; isDark: boolean }) {
  const W = width - 72;
  const H = 200;
  const bg = isDark ? '#111111' : '#F2F5EE';
  const routeColor = Colors.primary;

  if (coords.length < 2) {
    return (
      <View style={[styles.container, { backgroundColor: bg, width: W, height: H }]}>
        <Text style={{ color: isDark ? '#A1A1A0' : '#5F5E5A', fontSize: 13, fontFamily: 'Barlow-Regular' }}>
          Mapa disponible en dispositivo físico
        </Text>
      </View>
    );
  }

  const lats = coords.map(c => c.latitude);
  const lons = coords.map(c => c.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const pad = 20;

  const toX = (lon: number) => {
    const range = maxLon - minLon || 0.0001;
    return pad + ((lon - minLon) / range) * (W - pad * 2);
  };
  const toY = (lat: number) => {
    const range = maxLat - minLat || 0.0001;
    return pad + ((maxLat - lat) / range) * (H - pad * 2);
  };

  const points = coords.map(c => `${toX(c.longitude)},${toY(c.latitude)}`).join(' ');
  const last = coords[coords.length - 1];

  return (
    <View style={{ width: W, height: H, borderRadius: 12, overflow: 'hidden', backgroundColor: bg }}>
      <Svg width={W} height={H}>
        <Polyline points={points} fill="none" stroke={routeColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={toX(last.longitude)} cy={toY(last.latitude)} r={14} fill={routeColor + '33'} />
        <Circle cx={toX(coords[0].longitude)} cy={toY(coords[0].latitude)} r={6} fill={isDark ? '#A1A1A0' : '#5F5E5A'} />
        <Circle cx={toX(last.longitude)} cy={toY(last.latitude)} r={8} fill={routeColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
