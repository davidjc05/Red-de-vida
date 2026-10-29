import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  useColorScheme, Dimensions, ScrollView, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import RouteMap from '../../components/RouteMap';

const { width } = Dimensions.get('window');

const FC  = 'BarlowCondensed-ExtraBold';
const FB  = 'Barlow-Regular';
const FBB = 'Barlow-Bold';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Coord = { latitude: number; longitude: number };
type ActivityState = 'idle' | 'running' | 'paused' | 'finished';
type ActivityKind = 'run' | 'walk' | 'bike';
type SavedActivity = {
  id: string; date: string; kind: ActivityKind;
  elapsed: number; distance: number; kcal: number; route: Coord[];
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const LOCATION_TASK = 'red-de-vida-activity-location';
const STORAGE_KEY = 'red-de-vida:activities';
const MAX_ACCURACY = 30;        // metros: se ignoran fixes de GPS peores que esto
const DEFAULT_WEIGHT_KG = 70;   // TODO: sustituir por el peso real del perfil

// GPS no sirve para natación, por eso solo hay actividades de superficie.
const ACTIVITY_TYPES: { key: ActivityKind; label: string; kcalPerKgKm: number }[] = [
  { key: 'run',  label: 'Correr',  kcalPerKgKm: 1.0 },
  { key: 'walk', label: 'Caminar', kcalPerKgKm: 0.5 },
  { key: 'bike', label: 'Bici',    kcalPerKgKm: 0.3 },
];

// ─── Tarea de ubicación en segundo plano ──────────────────────────────────────
// El handler lo asigna el componente al empezar; así el task (que vive fuera de React)
// puede entregar las posiciones aunque la pantalla esté bloqueada.
let locationHandler: ((locs: Location.LocationObject[]) => void) | null = null;
let TaskManager: any = null;
if (Platform.OS !== 'web') {
  try {
    TaskManager = require('expo-task-manager');
    TaskManager.defineTask(LOCATION_TASK, ({ data, error }: any) => {
      if (error) { console.log(error); return; }
      const locations = (data && data.locations) || [];
      if (locationHandler) locationHandler(locations);
    });
  } catch (e) { console.log(e); }
}

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

// Estimación de calorías: kcal/kg/km según actividad × peso. Es una aproximación.
function estimateKcal(distanceM: number, kind: ActivityKind): number {
  const k = ACTIVITY_TYPES.find(t => t.key === kind)?.kcalPerKgKm ?? 1;
  return Math.round((distanceM / 1000) * k * DEFAULT_WEIGHT_KG);
}

// Reduce la ruta guardada para no llenar el almacenamiento.
function sampleRoute(c: Coord[], max = 300): Coord[] {
  if (c.length <= max) return c;
  const every = Math.ceil(c.length / max);
  return c.filter((_, i) => i % every === 0);
}

function startOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // lunes = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

// ─── Gráfica de ritmo ─────────────────────────────────────────────────────────
function PaceChart({ paces, isDark }: { paces: number[]; isDark: boolean }) {
  if (paces.length < 2) return null;
  const W = width - 72;
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
  const bg = isDark ? '#1A1A1A' : '#FFFFFF';
  const text = isDark ? '#F2F2F0' : '#1A1A1A';
  const sub = isDark ? '#A1A1A0' : '#5F5E5A';
  return (
    <View style={[bm.card, { backgroundColor: bg, borderColor: isDark ? '#2A2A2A' : '#E3E6DD' }]}>
      <Text style={[bm.label, { color: sub }]}>{label}</Text>
      <Text style={[bm.value, { color: text }]}>{value}</Text>
      <Text style={[bm.unit, { color: sub }]}>{unit}</Text>
    </View>
  );
}

const bm = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'flex-start', gap: 0 },
  value: { fontSize: 40, lineHeight: 44, fontFamily: FC, letterSpacing: -0.5, marginTop: 2 },
  unit: { fontSize: 12, fontFamily: FB },
  label: { fontSize: 12, fontFamily: FBB },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ActivityScreen() {
  const isDark = useColorScheme() === 'dark';

  const C = {
    bg:      isDark ? '#111111' : '#F2F5EE',
    surface: isDark ? '#1A1A1A' : '#FFFFFF',
    text:    isDark ? '#F2F2F0' : '#1A1A1A',
    textSub: isDark ? '#A1A1A0' : '#5F5E5A',
    border:  isDark ? '#2A2A2A' : '#E3E6DD',
    error:   '#EF4444',
  };

  const [state, setState] = useState<ActivityState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(0);       // m/s
  const [coords, setCoords] = useState<Coord[]>([]);
  const [paceHistory, setPaceHistory] = useState<number[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [selectedKind, setSelectedKind] = useState<ActivityKind>('run');
  const [savedOk, setSavedOk] = useState<boolean | null>(null);
  const [weekStats, setWeekStats] = useState({ count: 0, km: 0, kcal: 0 });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simPos = useRef({ lat: 40.4168, lon: -3.7038, step: 0 });
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const backgroundActive = useRef(false);
  const lastCoord = useRef<Coord | null>(null);
  const lastTime = useRef<number>(0);
  const resumeGap = useRef(false);   // tras una pausa, el primer fix no suma distancia
  const accMs = useRef(0);           // tiempo acumulado en tramos ya cerrados
  const segStart = useRef(0);        // inicio del tramo actual

  // Métricas derivadas
  const speedKmh = speed * 3.6;
  const paceSecPerKm = speed > 0.5 ? 1000 / speed : 0;
  const distanceKm = distance / 1000;
  const kindLabel = ACTIVITY_TYPES.find(t => t.key === selectedKind)?.label ?? '';

  useEffect(() => {
    requestPermissions();
    return () => stopTracking();
  }, []);

  // Estadísticas de la semana: se recargan cada vez que se vuelve a la pantalla inicial
  useEffect(() => {
    if (state === 'idle') loadWeekStats();
  }, [state]);

  const loadWeekStats = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list: SavedActivity[] = raw ? JSON.parse(raw) : [];
      const from = startOfWeek().getTime();
      const week = list.filter(a => new Date(a.date).getTime() >= from);
      setWeekStats({
        count: week.length,
        km: week.reduce((t, a) => t + a.distance, 0) / 1000,
        kcal: week.reduce((t, a) => t + a.kcal, 0),
      });
    } catch (e) { console.log(e); }
  };

  const persistActivity = async (finalElapsed: number) => {
    setSavedOk(null);
    if (finalElapsed < 5) return;
    try {
      const rec: SavedActivity = {
        id: String(Date.now()),
        date: new Date().toISOString(),
        kind: selectedKind,
        elapsed: finalElapsed,
        distance,
        kcal: estimateKcal(distance, selectedKind),
        route: sampleRoute(coords),
      };
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const list: SavedActivity[] = raw ? JSON.parse(raw) : [];
      list.push(rec);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50)));
      setSavedOk(true);
    } catch (e) {
      console.log(e);
      setSavedOk(false);
    }
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      setHasPermission(true);
      return true;
    }
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    if (!granted) {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tu ubicación para rastrear la actividad.',
        canAskAgain
          ? [{ text: 'Vale' }]
          : [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
            ]
      );
    }
    return granted;
  };

  // Procesa uno o varios fixes de GPS (en segundo plano pueden llegar en lote)
  const handleLocations = (locs: Location.LocationObject[]) => {
    for (const loc of locs) {
      const accuracy = loc.coords.accuracy ?? 0;
      if (accuracy > MAX_ACCURACY) continue;

      const newCoord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      const now = loc.timestamp ?? Date.now();
      const spd = loc.coords.speed;
      setSpeed(spd != null && spd > 0 ? spd : 0);

      if (lastCoord.current && !resumeGap.current) {
        const d = haversine(lastCoord.current, newCoord);
        // Por debajo de 1.5 m es ruido del GPS: se ignora y se conserva el punto anterior
        if (d > 1.5) {
          setDistance(prev => prev + d);
          setCoords(prev => [...prev, newCoord]);
          const pace = (now - lastTime.current) / 1000 / (d / 1000);
          if (pace > 0 && pace < 1800) setPaceHistory(prev => [...prev.slice(-30), pace]);
          lastCoord.current = newCoord;
          lastTime.current = now;
        }
      } else {
        // Primer fix, o primer fix tras una pausa: fija la referencia sin sumar distancia
        if (lastCoord.current) setCoords(prev => [...prev, newCoord]);
        else setCoords([newCoord]);
        resumeGap.current = false;
        lastCoord.current = newCoord;
        lastTime.current = now;
      }
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

    const ok = hasPermission ? true : await requestPermissions();
    if (!ok) return;

    setState('running');
    startTimer();
    locationHandler = handleLocations;

    // Segundo plano (pantalla bloqueada). Si no hay permiso o no está disponible
    // (p. ej. Expo Go), se usa el seguimiento normal en primer plano.
    let useBackground = false;
    if (TaskManager) {
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        useBackground = bg.status === 'granted';
      } catch (e) { useBackground = false; }
    }

    if (useBackground) {
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Red de Vida',
            notificationBody: 'Registrando tu actividad',
          },
        });
        backgroundActive.current = true;
      } catch (e) {
        console.log(e);
        useBackground = false;
      }
    }

    if (!useBackground) {
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        (loc) => handleLocations([loc])
      );
    }
  };

  // Simulación de movimiento para web
  const simulateMovement = () => {
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = setInterval(() => {
      const p = simPos.current;
      if (p.step > 200) { if (simRef.current) clearInterval(simRef.current); return; }
      p.lat += 0.00005 + Math.random() * 0.00003;
      p.lon += 0.00003 + Math.random() * 0.00002;
      const spd = 2.5 + Math.random() * 1.5;
      setSpeed(spd);
      setDistance(prev => prev + spd * 2);
      setCoords(prev => [...prev, { latitude: p.lat, longitude: p.lon }]);
      setPaceHistory(prev => [...prev.slice(-30), 1000 / spd]);
      p.step++;
    }, 2000);
  };

  // El tiempo se calcula con marcas de reloj, no sumando 1 por tick: así no se
  // desincroniza si el sistema retrasa el temporizador con la pantalla bloqueada.
  const syncElapsed = () => {
    setElapsed(Math.floor((accMs.current + (Date.now() - segStart.current)) / 1000));
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    segStart.current = Date.now();
    timerRef.current = setInterval(syncElapsed, 500);
  };

  const pauseTracking = () => {
    accMs.current += Date.now() - segStart.current;
    setElapsed(Math.floor(accMs.current / 1000));
    stopTracking();
    setSpeed(0);
    resumeGap.current = true;
    setState('paused');
  };

  const resumeTracking = () => {
    resumeGap.current = true;
    if (Platform.OS === 'web') {
      setState('running');
      startTimer();
      simulateMovement();
    } else {
      startTracking();
    }
  };

  const stopTracking = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (simRef.current) clearInterval(simRef.current);
    locationSub.current?.remove();
    locationSub.current = null;
    if (backgroundActive.current) {
      backgroundActive.current = false;
      Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    }
    locationHandler = null;
  };

  const finishActivity = () => {
    let totalMs = accMs.current;
    if (state === 'running') totalMs += Date.now() - segStart.current;
    accMs.current = totalMs;
    const finalElapsed = Math.floor(totalMs / 1000);
    setElapsed(finalElapsed);
    stopTracking();
    setState('finished');
    persistActivity(finalElapsed);
  };

  const resetActivity = () => {
    stopTracking();
    setState('idle');
    setElapsed(0);
    setDistance(0);
    setSpeed(0);
    setCoords([]);
    setPaceHistory([]);
    setSavedOk(null);
    lastCoord.current = null;
    lastTime.current = 0;
    resumeGap.current = false;
    accMs.current = 0;
    simPos.current = { lat: 40.4168, lon: -3.7038, step: 0 };
  };

  // ─── PANTALLA RESUMEN FINAL ───────────────────────────────────────────────
  if (state === 'finished') {
    const avgPace = elapsed > 0 && distance > 0 ? elapsed / (distance / 1000) : 0;
    const avgSpeed = elapsed > 0 ? (distance / elapsed) * 3.6 : 0;
    const kcal = estimateKcal(distance, selectedKind);

    return (
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>
          <View style={s.summaryHeader}>
            <Text style={[s.summaryTitle, { color: C.text }]}>¡Actividad completada!</Text>
            <Text style={[s.summarySub, { color: C.textSub }]}>
              {kindLabel} · Aquí tienes tu resumen
            </Text>
            {savedOk === true && (
              <Text style={[s.summarySub, { color: Colors.primary, fontFamily: FBB }]}>
                Guardada en tu dispositivo
              </Text>
            )}
            {savedOk === false && (
              <Text style={[s.summarySub, { color: C.error, fontFamily: FBB }]}>
                No se pudo guardar la actividad
              </Text>
            )}
          </View>

          <View style={[s.summaryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: C.text }]}>{formatTime(elapsed)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Tiempo</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: Colors.primary }]}>{distanceKm.toFixed(2)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>km</Text>
              </View>
            </View>
            <View style={[s.summaryDividerH, { backgroundColor: C.border }]} />
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: C.text }]}>{formatPace(avgPace)}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>Ritmo /km</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: C.border }]} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: C.text }]}>{kcal}</Text>
                <Text style={[s.summaryLbl, { color: C.textSub }]}>kcal estimadas</Text>
              </View>
            </View>
            <View style={[s.summaryDividerH, { backgroundColor: C.border }]} />
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: C.text }]}>{avgSpeed.toFixed(1)}</Text>
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
              <Text style={[s.sectionTitle, { color: C.text, marginBottom: 12 }]}>Ruta</Text>
              <RouteMap coords={coords} isDark={isDark} />
            </View>
          )}

          {paceHistory.length >= 2 && (
            <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[s.sectionTitle, { color: C.text, marginBottom: 8 }]}>Ritmo durante la actividad</Text>
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
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 16 }}>

          <View style={s.idleHeader}>
            <Text style={[s.idleTitle, { color: C.text }]}>Actividad</Text>
            <Text style={[s.idleSub, { color: C.textSub }]}>Registra tu carrera, caminata o entrenamiento</Text>
          </View>

          {/* Tipos de actividad */}
          <View style={s.activityTypes}>
            {ACTIVITY_TYPES.map(t => {
              const active = selectedKind === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setSelectedKind(t.key)}
                  style={[
                    s.typeCard,
                    { backgroundColor: C.surface, borderColor: C.border },
                    active && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                >
                  <Text style={[s.typeLabel, { color: active ? '#fff' : C.text }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stats de la semana (leídas de las actividades guardadas) */}
          <View style={[s.statsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Esta semana</Text>
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.text }]}>{weekStats.count}</Text>
                <Text style={[s.statLbl, { color: C.textSub }]}>actividades</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.text }]}>{weekStats.km.toFixed(2)}</Text>
                <Text style={[s.statLbl, { color: C.textSub }]}>km totales</Text>
              </View>
              <View style={s.statItem}>
                <Text style={[s.statVal, { color: C.text }]}>{weekStats.kcal}</Text>
                <Text style={[s.statLbl, { color: C.textSub }]}>kcal</Text>
              </View>
            </View>
          </View>

          {Platform.OS === 'web' && (
            <View style={[s.webNote, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={{ color: C.textSub, fontSize: 12, fontFamily: FB, textAlign: 'center' }}>
                En web el GPS está simulado. El tracking real funciona en dispositivo físico.
              </Text>
            </View>
          )}

          {/* Botón iniciar */}
          <TouchableOpacity style={[s.startBtn, { backgroundColor: Colors.primary }]} onPress={startTracking}>
            <Text style={s.startBtnText}>Iniciar actividad</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── PANTALLA EN MARCHA / PAUSADA ─────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 12 }}>

        {/* Estado */}
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: state === 'running' ? Colors.primary : '#F59E0B' }]} />
          <Text style={[s.statusText, { color: C.textSub }]}>
            {state === 'running' ? 'En marcha' : 'En pausa'} · {kindLabel}
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
          <BigMetric value={String(estimateKcal(distance, selectedKind))} label="Calorías" unit="kcal est." color="#EF4444" isDark={isDark} />
        </View>

        {/* Mapa */}
        <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.sectionTitle, { color: C.text, marginBottom: 12 }]}>Ruta en vivo</Text>
          <RouteMap coords={coords} isDark={isDark} />
        </View>

        {/* Gráfica de ritmo */}
        {paceHistory.length >= 2 && (
          <View style={[s.mapCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.sectionTitle, { color: C.text, marginBottom: 8 }]}>Ritmo</Text>
            <PaceChart paces={paceHistory} isDark={isDark} />
          </View>
        )}

        {/* Controles */}
        <View style={s.controls}>
          {state === 'running' ? (
            <TouchableOpacity style={[s.controlBtn, { backgroundColor: 'transparent', borderColor: C.border }]} onPress={pauseTracking}>
              <Text style={[s.controlLabel, { color: C.text }]}>Pausar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.controlBtn, { backgroundColor: Colors.primary, borderColor: Colors.primary }]} onPress={resumeTracking}>
              <Text style={[s.controlLabel, { color: '#fff' }]}>Continuar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.controlBtn, { backgroundColor: 'transparent', borderColor: '#E9A5A4' }]} onPress={finishActivity}>
            <Text style={[s.controlLabel, { color: '#D93B3A' }]}>Terminar</Text>
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
  idleHeader: { alignItems: 'flex-start', paddingVertical: 8, gap: 4 },
  idleTitle: { fontSize: 36, lineHeight: 38, fontFamily: FC },
  idleSub: { fontSize: 14, fontFamily: FB, textAlign: 'left' },
  activityTypes: { flexDirection: 'row', gap: 8 },
  typeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1 },
  typeLabel: { fontSize: 14, fontFamily: FBB },
  statsCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 2 },
  statVal: { fontSize: 32, lineHeight: 34, fontFamily: FC },
  statLbl: { fontSize: 12, fontFamily: FB },
  startBtn: { borderRadius: 12, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12 },
  startBtnText: { color: '#fff', fontSize: 22, fontFamily: FC, letterSpacing: 0.5 },
  webNote: { borderRadius: 12, borderWidth: 1, padding: 12 },
  // Running
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontFamily: FBB },
  timerCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 20, paddingHorizontal: 16, alignItems: 'flex-start', gap: 0 },
  timerText: { fontSize: 72, lineHeight: 76, fontFamily: FC, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 13, fontFamily: FB },
  metricsRow: { flexDirection: 'row', gap: 12 },
  mapCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  controls: { flexDirection: 'row', gap: 12 },
  controlBtn: { flex: 1, borderRadius: 12, borderWidth: 1, minHeight: 56, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { fontSize: 16, fontFamily: FBB },
  // Summary
  summaryHeader: { alignItems: 'flex-start', paddingVertical: 8, gap: 4 },
  summaryTitle: { fontSize: 34, lineHeight: 36, fontFamily: FC },
  summarySub: { fontSize: 14, fontFamily: FB },
  summaryCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'flex-start', padding: 18, gap: 2 },
  summaryVal: { fontSize: 36, lineHeight: 40, fontFamily: FC },
  summaryLbl: { fontSize: 12, fontFamily: FB },
  summaryDivider: { width: 1 },
  summaryDividerH: { height: 1 },
  sectionTitle: { fontSize: 15, fontFamily: FBB },
  btnPrimary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontFamily: FBB },
});
