import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  useColorScheme, Dimensions, ScrollView, Platform, Alert,
  ImageBackground,
} from 'react-native';
import * as Location from 'expo-location';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

// ─── Paleta ───────────────────────────────────────────────────────────────────
const P = {
  green:    '#3B6D11',
  greenMid: '#5A9E1A',
  greenLt:  '#EAF3DE',
  bgCream:  '#F2F5EE',
  border:   '#E5E2DB',
  textMain: '#1A1A1A',
  textSub:  '#5F5E5A',
  textHint: '#94A3B8',
  purple:   '#6366F1',
  amber:    '#F59E0B',
  red:      '#EF4444',
  teal:     '#10B981',
};

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

// ─── Mini mapa SVG ────────────────────────────────────────────────────────────
function RouteMap({ coords, isDark }: { coords: Coord[]; isDark: boolean }) {
  const W = width - 40;
  const H = 200;
  const bg = isDark ? '#0F172A' : '#E2E8F0';

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
      <Polyline points={points} fill="none" stroke={P.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={toX(coords[0].longitude)} cy={toY(coords[0].latitude)} r={6} fill={P.teal} />
      <Circle cx={toX(last.longitude)} cy={toY(last.latitude)} r={8} fill={P.green} />
      <Circle cx={toX(last.longitude)} cy={toY(last.latitude)} r={14} fill={P.green + '33'} />
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
      <Polyline points={points} fill="none" stroke={P.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Métrica de rendimiento (icono circular + valor + unidad + label) ─────────
function PerfMetric({ icon, value, unit, label, color }: {
  icon: string; value: string; unit: string; label: string; color: string;
}) {
  return (
    <View style={pm.cell}>
      <View style={[pm.iconCircle, { borderColor: color + '40', backgroundColor: color + '12' }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={[pm.value, { color }]}>{value}</Text>
      <Text style={pm.unit}>{unit}</Text>
      <Text style={pm.label}>{label}</Text>
    </View>
  );
}
const pm = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 4 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 11, color: P.textSub },
  label: { fontSize: 11, color: P.textSub, fontWeight: '600' },
});

// ─── BigMetric (para pantalla en marcha) ─────────────────────────────────────
function BigMetric({ value, label, unit, color, isDark }: {
  value: string; label: string; unit: string; color: string; isDark: boolean;
}) {
  const bg = isDark ? '#1E293B' : '#FFFFFF';
  const sub = isDark ? '#94A3B8' : P.textSub;
  return (
    <View style={[bm.card, { backgroundColor: bg, borderColor: isDark ? '#334155' : P.border }]}>
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
    bg:      isDark ? '#0F172A' : P.bgCream,
    surface: isDark ? '#1E293B' : '#FFFFFF',
    text:    isDark ? '#F1F5F9' : P.textMain,
    textSub: isDark ? '#94A3B8' : P.textSub,
    border:  isDark ? '#334155' : P.border,
  };

  const [state, setState]               = useState<ActivityState>('idle');
  const [elapsed, setElapsed]           = useState(0);
  const [distance, setDistance]         = useState(0);
  const [speed, setSpeed]               = useState(0);
  const [coords, setCoords]             = useState<Coord[]>([]);
  const [paceHistory, setPaceHistory]   = useState<number[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const lastCoord   = useRef<Coord | null>(null);
  const lastTime    = useRef<number>(0);

  const speedKmh     = speed * 3.6;
  const paceSecPerKm = speed > 0.5 ? 1000 / speed : 0;
  const distanceKm   = distance / 1000;

  useEffect(() => {
    requestPermissions();
    return () => stopTracking();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') { setHasPermission(true); return; }
    const { status } = await Location.requestForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status !== 'granted')
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu ubicación para rastrear la actividad.');
  };

  const startTracking = async () => {
    if (Platform.OS === 'web') {
      setState('running'); startTimer(); simulateMovement(); return;
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
        } else { setCoords([newCoord]); }
        lastCoord.current = newCoord;
        lastTime.current = now;
      }
    );
  };

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

  const finishActivity = () => { stopTracking(); setState('finished'); };

  const resetActivity = () => {
    stopTracking();
    setState('idle');
    setElapsed(0); setDistance(0); setSpeed(0);
    setCoords([]); setPaceHistory([]);
    lastCoord.current = null;
  };

  // ─── RESUMEN FINAL ────────────────────────────────────────────────────────
  if (state === 'finished') {
    const avgPace  = elapsed > 0 && distance > 0 ? elapsed / (distance / 1000) : 0;
    const avgSpeed = elapsed > 0 ? (distance / elapsed) * 3.6 : 0;
    const kcal     = Math.round(distance * 0.06);

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
                <Text style={[s.summaryVal, { color: P.green }]}>{formatTime(elapsed)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Tiempo</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: P.purple }]}>{distanceKm.toFixed(2)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>km</Text>
              </View>
            </View>
            <View style={[s.summaryDividerH, { backgroundColor: C.border }]} />
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: P.amber }]}>{formatPace(avgPace)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Ritmo /km</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: P.red }]}>{kcal}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>kcal</Text>
              </View>
            </View>
            <View style={[s.summaryDividerH, { backgroundColor: C.border }]} />
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: P.teal }]}>{avgSpeed.toFixed(1)}</Text>
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

          <TouchableOpacity style={[s.startBtn, { backgroundColor: P.green }]} onPress={resetActivity}>
            <Text style={s.startBtnText}>Nueva actividad</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PANTALLA IDLE ────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }} showsVerticalScrollIndicator={false}>

          {/* ── HEADER con fondoInicio.png ── */}
          <ImageBackground
            source={require('../../assets/images/fondoInicio.png')}
            style={s.header}
            resizeMode="cover"
          >
            <View style={s.headerOverlay} pointerEvents="none" />
            <View style={s.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.headerTitle, { color: C.text }]}>Actividad</Text>
                <Text style={[s.headerSub, { color: C.textSub }]}>
                  Registra tu carrera, caminata o entrenamiento
                </Text>
              </View>
              {/* Icono hoja círculo verde */}
              <View style={s.headerIconCircle}>
                <Text style={{ fontSize: 22 }}>🌿</Text>
              </View>
            </View>
          </ImageBackground>

          <View style={{ padding: 16, gap: 14 }}>

            {/* ── Esta semana ── */}
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={s.cardHeader}>
                <View style={[s.cardIconBox, { backgroundColor: P.greenLt }]}>
                  <Text style={{ fontSize: 16 }}>📊</Text>
                </View>
                <Text style={[s.cardTitle, { color: C.text }]}>Esta semana</Text>
              </View>
              {/* Divisor */}
              <View style={[s.hDivider, { backgroundColor: C.border }]} />
              <View style={s.weekStatsRow}>
                <View style={s.weekStatItem}>
                  <Text style={[s.weekStatVal, { color: P.green }]}>0</Text>
                  <Text style={[s.weekStatLbl, { color: C.textSub }]}>actividades</Text>
                </View>
                <View style={[s.vDivider, { backgroundColor: C.border }]} />
                <View style={s.weekStatItem}>
                  <Text style={[s.weekStatVal, { color: P.purple }]}>0.00</Text>
                  <Text style={[s.weekStatLbl, { color: C.textSub }]}>km totales</Text>
                </View>
                <View style={[s.vDivider, { backgroundColor: C.border }]} />
                <View style={s.weekStatItem}>
                  <Text style={[s.weekStatVal, { color: P.amber }]}>0</Text>
                  <Text style={[s.weekStatLbl, { color: C.textSub }]}>kcal</Text>
                </View>
              </View>
            </View>

            {/* ── Aviso web ── */}
            {Platform.OS === 'web' && (
              <View style={s.webNote}>
                <View style={s.webNoteIcon}>
                  <Text style={{ fontSize: 16 }}>⚠️</Text>
                </View>
                <Text style={s.webNoteText}>
                  En web el GPS está simulado.{'\n'}El tracking real funciona en dispositivo físico.
                </Text>
              </View>
            )}

            {/* ── Botón iniciar ── */}
            <TouchableOpacity
              style={s.startBtn}
              onPress={startTracking}
              activeOpacity={0.85}
            >
              <View style={s.startBtnPlayCircle}>
                <Text style={{ fontSize: 20, color: P.green }}>▶</Text>
              </View>
              <Text style={s.startBtnText}>Iniciar actividad</Text>
            </TouchableOpacity>

            {/* ── Resumen de rendimiento ── */}
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.cardHeader, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[s.cardIconBox, { backgroundColor: P.greenLt }]}>
                    <Text style={{ fontSize: 16 }}>📈</Text>
                  </View>
                  <Text style={[s.cardTitle, { color: C.text }]}>Resumen de rendimiento</Text>
                </View>
                <TouchableOpacity style={[s.periodBtn, { borderColor: C.border }]}>
                  <Text style={[s.periodBtnText, { color: C.textSub }]}>Esta semana</Text>
                  <Text style={{ color: C.textSub, fontSize: 11 }}>▾</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.hDivider, { backgroundColor: C.border }]} />

              {/* Fila 1: Distancia, Velocidad media, Tiempo total */}
              <View style={s.perfRow}>
                <PerfMetric icon="📍" value="0.00" unit="km" label="Distancia" color={P.green} />
                <View style={[s.vDivider, { backgroundColor: C.border, alignSelf: 'stretch' }]} />
                <PerfMetric icon="🏎️" value="0.0" unit="km/h" label="Velocidad media" color={P.green} />
                <View style={[s.vDivider, { backgroundColor: C.border, alignSelf: 'stretch' }]} />
                <PerfMetric icon="⏱️" value="00:00" unit="h" label="Tiempo total" color={P.green} />
              </View>
              <View style={[s.hDivider, { backgroundColor: C.border }]} />
              {/* Fila 2: Ritmo, Calorías, Pasos */}
              <View style={s.perfRow}>
                <PerfMetric icon="⏰" value="00:00" unit="min/km" label="Ritmo medio" color={P.green} />
                <View style={[s.vDivider, { backgroundColor: C.border, alignSelf: 'stretch' }]} />
                <PerfMetric icon="🔥" value="0" unit="kcal" label="Calorías" color={P.amber} />
                <View style={[s.vDivider, { backgroundColor: C.border, alignSelf: 'stretch' }]} />
                <PerfMetric icon="👟" value="0" unit="pasos" label="Pasos totales" color={P.green} />
              </View>
            </View>

            {/* ── Actividad reciente ── */}
            <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[s.cardHeader, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[s.cardIconBox, { backgroundColor: P.greenLt }]}>
                    <Text style={{ fontSize: 16 }}>📅</Text>
                  </View>
                  <Text style={[s.cardTitle, { color: C.text }]}>Actividad reciente</Text>
                </View>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 13, color: P.green, fontWeight: '700' }}>Ver todas</Text>
                  <Text style={{ fontSize: 14, color: P.green }}>›</Text>
                </TouchableOpacity>
              </View>
              <View style={[s.hDivider, { backgroundColor: C.border }]} />

              {/* Estado vacío */}
              <View style={s.emptyActivity}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.emptyTitle, { color: C.text }]}>
                    Aún no tienes actividades registradas.
                  </Text>
                  <Text style={[s.emptySub, { color: C.textSub }]}>
                    ¡Empieza tu primera actividad!
                  </Text>
                </View>
                <Text style={s.emptyShoe}>👟</Text>
              </View>
            </View>

          </View>
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
          <View style={[s.statusDot, { backgroundColor: state === 'running' ? P.teal : P.amber }]} />
          <Text style={[s.statusText, { color: C.textSub }]}>
            {state === 'running' ? 'En marcha' : 'En pausa'}
          </Text>
        </View>

        {/* Tiempo grande */}
        <View style={[s.timerCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.timerText, { color: C.text }]}>{formatTime(elapsed)}</Text>
          <Text style={[s.timerLabel, { color: C.textSub }]}>tiempo transcurrido</Text>
        </View>

        {/* Métricas */}
        <View style={s.metricsRow}>
          <BigMetric value={distanceKm.toFixed(2)} label="Distancia" unit="km" color={P.purple} isDark={isDark} />
          <BigMetric value={speedKmh.toFixed(1)} label="Velocidad" unit="km/h" color={P.green} isDark={isDark} />
        </View>
        <View style={s.metricsRow}>
          <BigMetric value={formatPace(paceSecPerKm)} label="Ritmo" unit="min/km" color={P.amber} isDark={isDark} />
          <BigMetric value={String(Math.round(distance * 0.06))} label="Calorías" unit="kcal" color={P.red} isDark={isDark} />
        </View>

        {/* Mapa */}
        <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.text, marginBottom: 12 }]}>📍 Ruta en vivo</Text>
          <RouteMap coords={coords} isDark={isDark} />
        </View>

        {paceHistory.length >= 2 && (
          <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text, marginBottom: 8 }]}>📈 Ritmo</Text>
            <PaceChart paces={paceHistory} isDark={isDark} />
          </View>
        )}

        {/* Controles */}
        <View style={s.controls}>
          {state === 'running' ? (
            <TouchableOpacity
              style={[s.controlBtn, { backgroundColor: P.amber + '18', borderColor: P.amber }]}
              onPress={pauseTracking}
            >
              <Text style={{ fontSize: 28 }}>⏸</Text>
              <Text style={[s.controlLabel, { color: P.amber }]}>Pausar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.controlBtn, { backgroundColor: P.green + '18', borderColor: P.green }]}
              onPress={resumeTracking}
            >
              <Text style={{ fontSize: 28 }}>▶️</Text>
              <Text style={[s.controlLabel, { color: P.green }]}>Continuar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.controlBtn, { backgroundColor: P.red + '18', borderColor: P.red }]}
            onPress={finishActivity}
          >
            <Text style={{ fontSize: 28 }}>⏹</Text>
            <Text style={[s.controlLabel, { color: P.red }]}>Terminar</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(242, 245, 238, 0.75)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  headerSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  headerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: P.greenLt,
    borderWidth: 1.5,
    borderColor: P.green + '30',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Cards genéricas ──
  card: {
    borderRadius: 18,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },

  // ── Divisores ──
  hDivider: { height: 0.5 },
  vDivider: { width: 0.5 },

  // ── Esta semana ──
  weekStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  weekStatVal: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  weekStatLbl: { fontSize: 11, fontWeight: '600' },

  // ── Aviso web ──
  webNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: P.amber + '12',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.amber + '40',
    padding: 14,
  },
  webNoteIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: P.amber + '20',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  webNoteText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  // ── Botón iniciar ──
  startBtn: {
    backgroundColor: P.green,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  startBtnPlayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── Selector periodo ──
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  periodBtnText: { fontSize: 12, fontWeight: '500' },

  // ── Fila de métricas de rendimiento ──
  perfRow: { flexDirection: 'row', alignItems: 'stretch' },

  // ── Actividad reciente vacía ──
  emptyActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  emptySub: { fontSize: 12, marginTop: 4 },
  emptyShoe: { fontSize: 52, opacity: 0.25 },

  // ── En marcha ──
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  timerCard: {
    borderRadius: 20, borderWidth: 0.5,
    padding: 24, alignItems: 'center', gap: 4,
  },
  timerText: {
    fontSize: 56, fontWeight: '800',
    letterSpacing: -2, fontVariant: ['tabular-nums'],
  },
  timerLabel: { fontSize: 12 },
  metricsRow: { flexDirection: 'row', gap: 12 },
  mapCard: { borderRadius: 16, borderWidth: 0.5, padding: 16 },
  controls: { flexDirection: 'row', gap: 12 },
  controlBtn: {
    flex: 1, borderRadius: 16, borderWidth: 1.5,
    padding: 20, alignItems: 'center', gap: 8,
  },
  controlLabel: { fontSize: 13, fontWeight: '700' },

  // ── Resumen final ──
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
});