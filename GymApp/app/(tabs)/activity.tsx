import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  useColorScheme, Dimensions, ScrollView, Platform, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Coord = { latitude: number; longitude: number };
type ActivityState = 'idle' | 'running' | 'paused' | 'finished';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(a: Coord, b: Coord): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatPace(paceSecPerKm: number): string {
  if (!isFinite(paceSecPerKm) || paceSecPerKm <= 0) return '--:--';
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Mini mapa SVG (simulado en web, real en móvil) ───────────────────────────
function RouteMap({ coords, isDark }: { coords: Coord[]; isDark: boolean }) {
  const W = width - 40;
  const H = 200;
  const bg = isDark ? '#0F172A' : '#E2E8F0';
  const routeColor = Colors.primary;

  if (coords.length < 2) {
    return (
      <View style={[rm.container, { backgroundColor: bg, width: W, height: H }]}>
        <Text style={{ color: isDark ? '#334155' : '#94A3B8', fontSize: 13 }}>
          {Platform.OS === 'web' ? '🗺️ Mapa disponible en dispositivo físico' : '📍 Iniciando GPS...'}
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
    <Svg width={W} height={H} style={{ borderRadius: 16 }}>
      <Polyline points={points} fill="none" stroke={routeColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={toX(coords[0].longitude)} cy={toY(coords[0].latitude)} r={6} fill="#10B981" />
      <Circle cx={toX(last.longitude)} cy={toY(last.latitude)} r={8} fill={routeColor} />
      <Circle cx={toX(last.longitude)} cy={toY(last.latitude)} r={14} fill={routeColor + '33'} />
    </Svg>
  );
}

const rm = StyleSheet.create({
  container: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

// ─── Gráfica de ritmo ─────────────────────────────────────────────────────────
function PaceChart({ paces, isDark }: { paces: number[]; isDark: boolean }) {
  if (paces.length < 2) return null;
  const W = width - 40;
  const H = 60;
  const valid = paces.filter(p => isFinite(p) && p > 0);
  if (valid.length < 2) return null;
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const range = max - min || 1;
  const step = (W - 20) / (paces.length - 1);
  const points = paces.map((p, i) => {
    const x = 10 + i * step;
    const y = H - 10 - ((p - min) / range) * (H - 20);
    return `${x},${isFinite(y) ? y : H / 2}`;
  }).join(' ');

  return (
    <Svg width={W} height={H}>
      <Polyline points={points} fill="none" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Tarjeta de métrica grande ────────────────────────────────────────────────
function BigMetric({ value, label, unit, color, isDark }: {
  value: string; label: string; unit: string; color: string; isDark: boolean;
}) {
  const bg = isDark ? '#1E293B' : '#FFFFFF';
  const text = isDark ? '#F1F5F9' : '#1A1A1A';
  const sub = isDark ? '#94A3B8' : '#64748B';
  return (
    <View style={[bm.card, { backgroundColor: bg, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
      <Text style={[bm.value, { color }]}>{value}</Text>
      <Text style={[bm.unit, { color: sub }]}>{unit}</Text>
      <Text style={[bm.label, { color: sub }]}>{label}</Text>
    </View>
  );
}

const bm = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, borderWidth: 0.5, padding: 16, alignItems: 'center', gap: 2 },
  value: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  unit: { fontSize: 11, fontWeight: '600' },
  label: { fontSize: 11, marginTop: 2 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ActivityScreen() {
  const isDark = useColorScheme() === 'dark';

  const C = {
    bg:      isDark ? '#0F172A' : '#F5F5F5',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    text:    isDark ? '#F1F5F9' : '#1A1A1A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    border:  isDark ? '#334155' : '#E2E8F0',
    error:   '#EF4444',
  };

  const [state, setState] = useState<ActivityState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);       // m/s
  const [coords, setCoords] = useState<Coord[]>([]);
  const [paceHistory, setPaceHistory] = useState<number[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastCoord = useRef<Coord | null>(null);
  const lastTime = useRef<number>(0);

  // Métricas derivadas
  const speedKmh = speed * 3.6;
  const paceSecPerKm = speed > 0.5 ? 1000 / speed : 0;
  const distanceKm = distance / 1000;

  useEffect(() => {
    requestPermissions();
    return () => stopTracking();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      setHasPermission(true);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu ubicación para rastrear la actividad.');
    }
  };

  const startTracking = async () => {
    if (Platform.OS === 'web') {
      // Simulación en web
      setState('running');
      startTimer();
      simulateMovement();
      return;
    }

    if (!hasPermission) { await requestPermissions(); return; }

    setState('running');
    startTimer();

    locationSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
      (loc) => {
        const newCoord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        const now = Date.now();
        const spd = loc.coords.speed ?? 0;
        setSpeed(Math.max(spd, 0));

        if (lastCoord.current) {
          const d = haversine(lastCoord.current, newCoord);
          if (d > 0.5) {
            setDistance(prev => prev + d);
            setCoords(prev => [...prev, newCoord]);
            const pace = d > 0 ? (now - lastTime.current) / 1000 / (d / 1000) : 0;
            if (pace > 0 && pace < 1800) setPaceHistory(prev => [...prev.slice(-30), pace]);
          }
        } else {
          setCoords([newCoord]);
        }
        lastCoord.current = newCoord;
        lastTime.current = now;
      }
    );
  };

  // Simulación de movimiento para web
  const simulateMovement = () => {
    let baseLat = 40.4168, baseLon = -3.7038, step = 0;
    const sim = setInterval(() => {
      if (step > 200) { clearInterval(sim); return; }
      baseLat += 0.00005 + Math.random() * 0.00003;
      baseLon += 0.00003 + Math.random() * 0.00002;
      const spd = 2.5 + Math.random() * 1.5;
      setSpeed(spd);
      setDistance(prev => prev + spd * 2);
      setCoords(prev => [...prev, { latitude: baseLat, longitude: baseLon }]);
      setPaceHistory(prev => [...prev.slice(-30), 1000 / spd]);
      step++;
    }, 2000);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  };

  const pauseTracking = () => {
    setState('paused');
    if (timerRef.current) clearInterval(timerRef.current);
    locationSub.current?.remove();
  };

  const resumeTracking = () => {
    setState('running');
    startTimer();
    if (Platform.OS !== 'web') startTracking();
  };

  const stopTracking = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    locationSub.current?.remove();
  };

  const finishActivity = () => {
    stopTracking();
    setState('finished');
  };

  const resetActivity = () => {
    stopTracking();
    setState('idle');
    setElapsed(0);
    setDistance(0);
    setSpeed(0);
    setCoords([]);
    setPaceHistory([]);
    lastCoord.current = null;
  };

  // ─── PANTALLA RESUMEN FINAL ───────────────────────────────────────────────
  if (state === 'finished') {
    const avgPace = elapsed > 0 && distance > 0 ? elapsed / (distance / 1000) : 0;
    const avgSpeed = elapsed > 0 ? (distance / elapsed) * 3.6 : 0;
    const kcal = Math.round(distance * 0.06);

    return (
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}>
          <View style={s.summaryHeader}>
            <Text style={{ fontSize: 48 }}>🏅</Text>
            <Text style={[s.summaryTitle, { color: C.text }]}>¡Actividad completada!</Text>
            <Text style={[s.summarySub, { color: C.textSub }]}>Aquí tienes tu resumen</Text>
          </View>

          <View style={[s.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: Colors.primary }]}>{formatTime(elapsed)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Tiempo</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: '#6366F1' }]}>{distanceKm.toFixed(2)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>km</Text>
              </View>
            </View>
            <View style={[s.summaryDividerH, { backgroundColor: C.border }]} />
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: '#F59E0B' }]}>{formatPace(avgPace)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Ritmo /km</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: '#EF4444' }]}>{kcal}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>kcal</Text>
              </View>
            </View>
            <View style={[s.summaryDividerH, { backgroundColor: C.border }]} />
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: '#10B981' }]}>{avgSpeed.toFixed(1)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Vel. media km/h</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: C.text }]}>{coords.length}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Puntos GPS</Text>
              </View>
            </View>
          </View>

          {coords.length >= 2 && (
            <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.text, marginBottom: 12 }]}>🗺️ Ruta</Text>
              <RouteMap coords={coords} isDark={isDark} />
            </View>
          )}

          {paceHistory.length >= 2 && (
            <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.text, marginBottom: 8 }]}>📈 Ritmo durante la actividad</Text>
              <PaceChart paces={paceHistory} isDark={isDark} />
            </View>
          )}

          <TouchableOpacity style={[s.btnPrimary, { backgroundColor: Colors.primary }]} onPress={resetActivity}>
            <Text style={s.btnPrimaryText}>Nueva actividad</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PANTALLA IDLE ────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}>

          <View style={s.idleHeader}>
            <Text style={[s.idleTitle, { color: C.text }]}>Actividad</Text>
            <Text style={[s.idleSub, { color: C.textSub }]}>Registra tu carrera, caminata o entrenamiento</Text>
          </View>

          {/* Tipos de actividad */}
          <View style={s.activityTypes}>
            {[
              { icon: '🏃', label: 'Correr', color: Colors.primary },
              { icon: '🚶', label: 'Caminar', color: '#10B981' },
              { icon: '🚴', label: 'Bici', color: '#6366F1' },
              { icon: '🏊', label: 'Nadar', color: '#0EA5E9' },
            ].map((t, i) => (
              <TouchableOpacity key={i} style={[s.typeCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={{ fontSize: 28 }}>{t.icon}</Text>
                <Text style={[s.typeLabel, { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stats recientes simulados */}
          <View style={[s.statsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>📊 Esta semana</Text>
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: Colors.primary }]}>0</Text>
                <Text style={[s.statLbl, { color: C.textSub }]}>actividades</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: '#6366F1' }]}>0.00</Text>
                <Text style={[s.statLbl, { color: C.textSub }]}>km totales</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: '#F59E0B' }]}>0</Text>
                <Text style={[s.statLbl, { color: C.textSub }]}>kcal</Text>
              </View>
            </View>
          </View>

          {Platform.OS === 'web' && (
            <View style={[s.webNote, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B44' }]}>
              <Text style={{ color: '#F59E0B', fontSize: 12, textAlign: 'center' }}>
                ⚠️ En web el GPS está simulado. El tracking real funciona en dispositivo físico.
              </Text>
            </View>
          )}

          {/* Botón iniciar */}
          <TouchableOpacity style={[s.startBtn, { backgroundColor: Colors.primary }]} onPress={startTracking}>
            <Text style={{ fontSize: 36 }}>▶</Text>
            <Text style={s.startBtnText}>Iniciar actividad</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PANTALLA EN MARCHA / PAUSADA ─────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16 }}>

        {/* Estado */}
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: state === 'running' ? '#10B981' : '#F59E0B' }]} />
          <Text style={[s.statusText, { color: C.textSub }]}>
            {state === 'running' ? 'En marcha' : 'En pausa'}
          </Text>
        </View>

        {/* Tiempo grande */}
        <View style={[s.timerCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.timerText, { color: C.text }]}>{formatTime(elapsed)}</Text>
          <Text style={[s.timerLabel, { color: C.textSub }]}>tiempo transcurrido</Text>
        </View>

        {/* Métricas principales */}
        <View style={s.metricsRow}>
          <BigMetric value={distanceKm.toFixed(2)} label="Distancia" unit="km" color="#6366F1" isDark={isDark} />
          <BigMetric value={speedKmh.toFixed(1)} label="Velocidad" unit="km/h" color={Colors.primary} isDark={isDark} />
        </View>
        <View style={s.metricsRow}>
          <BigMetric value={formatPace(paceSecPerKm)} label="Ritmo" unit="min/km" color="#F59E0B" isDark={isDark} />
          <BigMetric value={String(Math.round(distance * 0.06))} label="Calorías" unit="kcal" color="#EF4444" isDark={isDark} />
        </View>

        {/* Mapa */}
        <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.text, marginBottom: 12 }]}>📍 Ruta en vivo</Text>
          <RouteMap coords={coords} isDark={isDark} />
        </View>

        {/* Gráfica de ritmo */}
        {paceHistory.length >= 2 && (
          <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text, marginBottom: 8 }]}>📈 Ritmo</Text>
            <PaceChart paces={paceHistory} isDark={isDark} />
          </View>
        )}

        {/* Controles */}
        <View style={s.controls}>
          {state === 'running' ? (
            <TouchableOpacity style={[s.controlBtn, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B' }]} onPress={pauseTracking}>
              <Text style={{ fontSize: 28 }}>⏸</Text>
              <Text style={[s.controlLabel, { color: '#F59E0B' }]}>Pausar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.controlBtn, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary }]} onPress={resumeTracking}>
              <Text style={{ fontSize: 28 }}>▶️</Text>
              <Text style={[s.controlLabel, { color: Colors.primary }]}>Continuar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.controlBtn, { backgroundColor: '#EF444418', borderColor: '#EF4444' }]} onPress={finishActivity}>
            <Text style={{ fontSize: 28 }}>⏹</Text>
            <Text style={[s.controlLabel, { color: '#EF4444' }]}>Terminar</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  // Idle
  idleHeader: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  idleTitle: { fontSize: 32, fontWeight: '800' },
  idleSub: { fontSize: 14, textAlign: 'center' },
  activityTypes: { flexDirection: 'row', gap: 10 },
  typeCard: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 0.5, gap: 6 },
  typeLabel: { fontSize: 11, fontWeight: '700' },
  statsCard: { borderRadius: 16, borderWidth: 0.5, padding: 16, gap: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 4 },
  statVal: { fontSize: 24, fontWeight: '800' },
  statLbl: { fontSize: 11 },
  startBtn: { borderRadius: 20, padding: 20, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12 },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  webNote: { borderRadius: 12, borderWidth: 1, padding: 12 },
  // Running
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  timerCard: { borderRadius: 20, borderWidth: 0.5, padding: 24, alignItems: 'center', gap: 4 },
  timerText: { fontSize: 56, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 12 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  mapCard: { borderRadius: 16, borderWidth: 0.5, padding: 16 },
  controls: { flexDirection: 'row', gap: 12 },
  controlBtn: { flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 20, alignItems: 'center', gap: 8 },
  controlLabel: { fontSize: 13, fontWeight: '700' },
  // Summary
  summaryHeader: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  summaryTitle: { fontSize: 24, fontWeight: '800' },
  summarySub: { fontSize: 14 },
  summaryCard: { borderRadius: 20, borderWidth: 0.5, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center', padding: 20, gap: 4 },
  summaryVal: { fontSize: 28, fontWeight: '800' },
  summaryLbl: { fontSize: 12 },
  summaryDivider: { width: 0.5 },
  summaryDividerH: { height: 0.5 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  btnPrimary: { borderRadius: 14, padding: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});