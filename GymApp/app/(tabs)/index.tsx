import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, Dimensions, SafeAreaView, ActivityIndicator,
} from 'react-native';
//Poner esto para movil cuando este echo 
// import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
let Pedometer: any = null;
if (Platform.OS !== 'web') {
  Pedometer = require('expo-sensors').Pedometer;
}
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { getMe, getMyAssignments } from '../../services/api';

const { width } = Dimensions.get('window');
const STEP_GOAL = 10000;

// ─── Mini gráfica de barras semanal ───────────────────────────────────────────
function WeekBarChart({ data, color, isDark }: { data: number[]; color: string; isDark: boolean }) {
  const H = 80;
  const W = width - 80;
  const max = Math.max(...data, 1);
  const barW = (W / 7) * 0.5;
  const gap = W / 7;
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  return (
    <Svg width={W} height={H + 20}>
      {data.map((val, i) => {
        const barH = (val / max) * H;
        const x = i * gap + gap / 2 - barW / 2;
        const y = H - barH;
        return (
          <React.Fragment key={i}>
            <Line
              x1={x + barW / 2} y1={H} x2={x + barW / 2} y2={y}
              stroke={i === 6 ? color : color + '55'}
              strokeWidth={barW}
              strokeLinecap="round"
            />
            <SvgText x={x + barW / 2} y={H + 16} fontSize="10" fill={textColor} textAnchor="middle">
              {days[i]}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Anillo de progreso ───────────────────────────────────────────────────────
function RingProgress({ value, max, size, color, label, sublabel }: {
  value: number; max: number; size: number; color: string; label: string; sublabel: string;
}) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const progress = Math.min(value / max, 1);
  const dash = circ * progress;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color + '22'} strokeWidth={8} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color }}>{label}</Text>
        <Text style={{ fontSize: 11, color: color + 'AA' }}>{sublabel}</Text>
      </View>
    </View>
  );
}

// ─── Tarjeta de métrica ───────────────────────────────────────────────────────
function MetricCard({ icon, label, value, unit, color, isDark }: {
  icon: string; label: string; value: string; unit: string; color: string; isDark: boolean;
}) {
  const bg = isDark ? '#1E293B' : '#FFFFFF';
  const text = isDark ? '#F1F5F9' : '#1A1A1A';
  const sub = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={[mc.card, { backgroundColor: bg, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
      <View style={[mc.iconBox, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={[mc.value, { color: text }]}>{value}</Text>
      <Text style={[mc.unit, { color }]}>{unit}</Text>
      <Text style={[mc.label, { color: sub }]}>{label}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  card: { width: (width - 56) / 2, borderRadius: 16, borderWidth: 0.5, padding: 16, gap: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  value: { fontSize: 26, fontWeight: '800' },
  unit: { fontSize: 12, fontWeight: '600', marginTop: -2 },
  label: { fontSize: 12, marginTop: 2 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';

  const C = {
    bg:      isDark ? '#0F172A' : '#F5F5F5',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    text:    isDark ? '#F1F5F9' : '#1A1A1A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    border:  isDark ? '#334155' : '#E2E8F0',
  };

  const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
  const [stepsToday, setStepsToday] = useState(0);
  const [weeklySteps, setWeeklySteps] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);

  // Métricas estimadas a partir de pasos
  const calories = Math.round(stepsToday * 0.04);
  const distanceKm = (stepsToday * 0.762 / 1000).toFixed(2);
  const activeMin = Math.round(stepsToday / 100);

  useEffect(() => {
    loadData();
    setupPedometer();
  }, []);

  const loadData = async () => {
    try {
      const [me, assign] = await Promise.all([getMe(), getMyAssignments()]);
      setUser(me);
      setAssignments(assign ?? []);
    } catch {}
    finally { setLoading(false); }
  };
  //Eliminar esto y descomentar abajo para movil prueba final 
  const setupPedometer = async () => {
  if (Platform.OS === 'web' || !Pedometer) {
    // En web simulamos datos para poder ver el diseño
    setIsPedometerAvailable(false);
    setStepsToday(6842);
    setWeeklySteps([4200, 8100, 6500, 9200, 7800, 5300, 6842]);
    return;
  }

  const available = await Pedometer.isAvailableAsync();
  setIsPedometerAvailable(available);
  if (!available) return;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  try {
    const result = await Pedometer.getStepCountAsync(start, now);
    setStepsToday(result.steps);
  } catch {}

  const weekly: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    try {
      const r = await Pedometer.getStepCountAsync(dayStart, dayEnd);
      weekly.push(r.steps);
    } catch { weekly.push(0); }
  }
  setWeeklySteps(weekly);

  Pedometer.watchStepCount(result => {
    setStepsToday(prev => prev + result.steps);
  });
};

  // const setupPedometer = async () => {
  //   const available = await Pedometer.isAvailableAsync();
  //   setIsPedometerAvailable(available);

  //   if (!available) return;

  //   // Pasos de hoy
  //   const now = new Date();
  //   const start = new Date(now);
  //   start.setHours(0, 0, 0, 0);
  //   try {
  //     const result = await Pedometer.getStepCountAsync(start, now);
  //     setStepsToday(result.steps);
  //   } catch {}

  //   // Pasos últimos 7 días
  //   const weekly: number[] = [];
  //   for (let i = 6; i >= 0; i--) {
  //     const dayStart = new Date();
  //     dayStart.setDate(dayStart.getDate() - i);
  //     dayStart.setHours(0, 0, 0, 0);
  //     const dayEnd = new Date(dayStart);
  //     dayEnd.setHours(23, 59, 59, 999);
  //     try {
  //       const r = await Pedometer.getStepCountAsync(dayStart, dayEnd);
  //       weekly.push(r.steps);
  //     } catch {
  //       weekly.push(0);
  //     }
  //   }
  //   setWeeklySteps(weekly);

  //   // Suscripción en tiempo real
  //   Pedometer.watchStepCount(result => {
  //     setStepsToday(prev => prev + result.steps);
  //   });
  // };

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayAssignments = assignments.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <View>
            <Text style={[s.greeting, { color: C.textSub }]}>
              {new Date().getHours() < 12 ? '☀️ Buenos días' : new Date().getHours() < 20 ? '💪 Buenas tardes' : '🌙 Buenas noches'}
            </Text>
            <Text style={[s.name, { color: C.text }]}>{user?.name ?? 'Atleta'}</Text>
            <Text style={[s.date, { color: C.textSub }]}>{today}</Text>
          </View>
          <View style={[s.avatarBox, { backgroundColor: Colors.primaryLight }]}>
            <Text style={{ fontSize: 24 }}>🏋️</Text>
          </View>
        </View>

        {/* ── Rutina de hoy ── */}
        {todayAssignments.length > 0 && (
          <View style={[s.section, { paddingHorizontal: 20, marginTop: 20 }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>💪 Rutina de hoy</Text>
            {todayAssignments.map((a, i) => (
              <View key={i} style={[s.routineToday, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '44' }]}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.primary }}>{a.routine?.name ?? 'Rutina asignada'}</Text>
                {a.note && <Text style={{ fontSize: 12, color: Colors.primary + 'AA', marginTop: 4 }}>{a.note}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* ── Anillo de pasos ── */}
        <View style={[s.ringSection, { backgroundColor: C.surface, borderColor: C.border }]}>
          <RingProgress
            value={stepsToday} max={STEP_GOAL}
            size={180} color={Colors.primary}
            label={stepsToday.toLocaleString()}
            sublabel="pasos"
          />
          <View style={s.ringMeta}>
            <Text style={[s.ringGoal, { color: C.textSub }]}>
              Meta: {STEP_GOAL.toLocaleString()} pasos
            </Text>
            <Text style={[s.ringPct, { color: Colors.primary }]}>
              {Math.min(Math.round((stepsToday / STEP_GOAL) * 100), 100)}% completado
            </Text>
          </View>
          {Platform.OS === 'web' && (
            <Text style={{ fontSize: 11, color: C.textSub, textAlign: 'center' }}>
              📱 Datos simulados — el sensor real funciona en dispositivo físico
            </Text>
          )}
          {/* {isPedometerAvailable ? (
            <>
              <RingProgress
                value={stepsToday} max={STEP_GOAL}
                size={180} color={Colors.primary}
                label={stepsToday.toLocaleString()}
                sublabel="pasos"
              />
              <View style={s.ringMeta}>
                <Text style={[s.ringGoal, { color: C.textSub }]}>
                  Meta: {STEP_GOAL.toLocaleString()} pasos
                </Text>
                <Text style={[s.ringPct, { color: Colors.primary }]}>
                  {Math.min(Math.round((stepsToday / STEP_GOAL) * 100), 100)}% completado
                </Text>
              </View>
            </>
          ) : (
            <View style={s.noSensor}>
              <Text style={{ fontSize: 32 }}>📱</Text>
              <Text style={[{ color: C.textSub, textAlign: 'center', fontSize: 13 }]}>
                El podómetro no está disponible en este dispositivo o simulador.{'\n'}Funcionará en un dispositivo físico.
              </Text>
            </View>
          )} */}
        </View>

        {/* ── Métricas ── */}
        <View style={[s.section, { paddingHorizontal: 20 }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>📊 Actividad de hoy</Text>
          <View style={s.metricsGrid}>
            <MetricCard icon="🔥" label="Calorías" value={calories.toString()} unit="kcal" color="#F97316" isDark={isDark} />
            <MetricCard icon="📍" label="Distancia" value={distanceKm} unit="km" color="#6366F1" isDark={isDark} />
            <MetricCard icon="⏱️" label="Minutos activo" value={activeMin.toString()} unit="min" color="#10B981" isDark={isDark} />
            <MetricCard icon="👣" label="Pasos" value={stepsToday.toLocaleString()} unit="pasos" color={Colors.primary} isDark={isDark} />
          </View>
        </View>

        {/* ── Gráfica semanal ── */}
        <View style={[s.section, { paddingHorizontal: 20 }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>📅 Pasos últimos 7 días</Text>
          <View style={[s.chartCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <WeekBarChart data={weeklySteps} color={Colors.primary} isDark={isDark} />
            <View style={s.chartFooter}>
              <Text style={[s.chartSub, { color: C.textSub }]}>
                Media: {Math.round(weeklySteps.reduce((a, b) => a + b, 0) / 7).toLocaleString()} pasos/día
              </Text>
              <Text style={[s.chartSub, { color: Colors.primary }]}>
                Total: {weeklySteps.reduce((a, b) => a + b, 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Próximas rutinas ── */}
        {assignments.length > 0 && (
          <View style={[s.section, { paddingHorizontal: 20 }]}>
            <Text style={[s.sectionTitle, { color: C.text }]}>📋 Próximas rutinas</Text>
            {assignments.slice(0, 3).map((a, i) => {
              const d = new Date(a.date);
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <View key={i} style={[s.assignRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <View style={[s.assignDateBox, { backgroundColor: isToday ? Colors.primary : C.border }]}>
                    <Text style={[s.assignDay, { color: isToday ? '#fff' : C.textSub }]}>{d.getDate()}</Text>
                    <Text style={[s.assignMonth, { color: isToday ? '#ffffffAA' : C.textSub }]}>
                      {d.toLocaleDateString('es-ES', { month: 'short' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.assignName, { color: C.text }]}>{a.routine?.name ?? 'Rutina'}</Text>
                    {a.note && <Text style={[s.assignNote, { color: C.textSub }]} numberOfLines={1}>{a.note}</Text>}
                  </View>
                  {isToday && (
                    <View style={[s.todayBadge, { backgroundColor: Colors.primary + '22' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.primary }}>HOY</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5 },
  greeting: { fontSize: 13, marginBottom: 2 },
  name: { fontSize: 24, fontWeight: '800' },
  date: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  avatarBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ringSection: { margin: 20, borderRadius: 20, borderWidth: 0.5, padding: 24, alignItems: 'center', gap: 12 },
  ringMeta: { alignItems: 'center', gap: 4 },
  ringGoal: { fontSize: 13 },
  ringPct: { fontSize: 15, fontWeight: '700' },
  noSensor: { alignItems: 'center', gap: 12, padding: 20 },
  section: { gap: 12, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chartCard: { borderRadius: 16, borderWidth: 0.5, padding: 16, alignItems: 'center', gap: 12 },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  chartSub: { fontSize: 12 },
  routineToday: { borderRadius: 14, borderWidth: 1, padding: 14 },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 0.5, padding: 12 },
  assignDateBox: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  assignDay: { fontSize: 16, fontWeight: '800' },
  assignMonth: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  assignName: { fontSize: 14, fontWeight: '600' },
  assignNote: { fontSize: 12, marginTop: 2 },
  todayBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});