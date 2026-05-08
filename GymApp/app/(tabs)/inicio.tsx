import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, Dimensions, SafeAreaView, ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Pedometer } from 'expo-sensors';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import { getMe, getMyAssignments } from '../../services/api';

const { width } = Dimensions.get('window');
const STEP_GOAL = 10000;

// ─── Gráfica de barras semanal ────────────────────────────────────────────────
function WeekBarChart({ data, color }: { data: number[]; color: string }) {
  const H = 72;
  const W = width - 80;
  const max = Math.max(...data, 1);
  const barW = (W / 7) * 0.45;
  const gap = W / 7;
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <Svg width={W} height={H + 20}>
      {data.map((val, i) => {
        const barH = Math.max((val / max) * H, 4);
        const x = i * gap + gap / 2 - barW / 2;
        const y = H - barH;
        const isToday = i === todayIdx;
        return (
          <React.Fragment key={i}>
            <Line
              x1={x + barW / 2} y1={H} x2={x + barW / 2} y2={y}
              stroke={isToday ? color : color + '44'}
              strokeWidth={barW}
              strokeLinecap="round"
            />
            <SvgText
              x={x + barW / 2} y={H + 16}
              fontSize="10" fill={isToday ? color : '#94A3B8'}
              textAnchor="middle" fontWeight={isToday ? '700' : '400'}
            >
              {days[i]}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Tarjeta métrica (fila de 4) ──────────────────────────────────────────────
function MetricCard({
  icon, label, value, unit, color,
}: {
  icon: string; label: string; value: string; unit: string; color: string;
}) {
  const cardW = (width - 52) / 4;
  return (
    <View style={[mc.card, { width: cardW }]}>
      <View style={[mc.iconBox, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={mc.value}>{value}</Text>
      <Text style={[mc.unit, { color }]}>{unit}</Text>
      <Text style={mc.label}>{label}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    padding: 10,
    alignItems: 'flex-start',
    gap: 2,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  unit:  { fontSize: 11, fontWeight: '700', marginTop: -2 },
  label: { fontSize: 10, color: '#64748B', marginTop: 1 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';

  const [isPedometerAvailable, setIsPedometerAvailable] = useState(false);
  const [stepsToday, setStepsToday]   = useState(0);
  const [weeklySteps, setWeeklySteps] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [loading, setLoading]         = useState(true);
  const [user, setUser]               = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);

  const calories    = Math.round(stepsToday * 0.04);
  const distanceKm  = (stepsToday * 0.762 / 1000).toFixed(2);
  const activeMin   = Math.round(stepsToday / 100);

  useEffect(() => { loadData(); setupPedometer(); }, []);

  const loadData = async () => {
    try {
      const [me, assign] = await Promise.all([getMe(), getMyAssignments()]);
      setUser(me);
      setAssignments(assign ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  const setupPedometer = async () => {
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

  const greeting = new Date().getHours() < 12
    ? '☀️ Buenos días'
    : new Date().getHours() < 20
      ? '👋 Buenas tardes'
      : '🌙 Buenas noches';

  const todayStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const todayStrCap = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);

  const todayAssignments = assignments.filter(a => {
    const d = new Date(a.date);
    return d.toDateString() === new Date().toDateString();
  });

  const upcomingAssignments = assignments
    .filter(a => new Date(a.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  const totalWeekSteps = weeklySteps.reduce((a, b) => a + b, 0);
  const avgWeekSteps   = Math.round(totalWeekSteps / 7);

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: Colors.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero con fondo ── */}
        <ImageBackground
          source={require('../../assets/images/fondoInicio.png')}
          style={s.hero}
          imageStyle={{ borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
          resizeMode="cover"
        >
          {/* Overlay suave para legibilidad */}
          <View style={s.heroOverlay} />

          <View style={s.heroContent}>
            {/* Saludo + avatar */}
            <View style={s.heroTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.greeting}>{greeting}</Text>
                <Text style={s.heroName}>{user?.name ?? 'Atleta'}</Text>
                <Text style={s.heroDate}>{todayStrCap}</Text>
              </View>
              <View style={s.avatarBox}>
                <Text style={{ fontSize: 26 }}>🏋️</Text>
              </View>
            </View>

            {/* Podómetro: banner o card */}
            {!isPedometerAvailable ? (
              <View style={s.pedometerCard}>
                <View style={s.pedometerIconCircle}>
                  <Text style={{ fontSize: 28 }}>👟</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pedometerTitle}>Podómetro no disponible</Text>
                  <Text style={s.pedometerSub}>
                    El podómetro no está disponible en este dispositivo o simulador.{'\n'}Funcionará en un dispositivo físico.
                  </Text>
                </View>
                <Text style={s.pedometerArrow}>›</Text>
              </View>
            ) : (
              <View style={s.stepsCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepsLabel}>Pasos hoy</Text>
                  <Text style={s.stepsValue}>{stepsToday.toLocaleString()}</Text>
                  <View style={s.stepsProgressBg}>
                    <View style={[s.stepsProgressFill, { width: `${Math.min((stepsToday / STEP_GOAL) * 100, 100)}%` as any }]} />
                  </View>
                  <Text style={s.stepsGoal}>Meta: {STEP_GOAL.toLocaleString()} · {Math.min(Math.round((stepsToday / STEP_GOAL) * 100), 100)}%</Text>
                </View>
                <Text style={{ fontSize: 36 }}>🥾</Text>
              </View>
            )}
          </View>
        </ImageBackground>

        <View style={s.body}>

          {/* ── Rutina de hoy ── */}
          {todayAssignments.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>💪 Rutina de hoy</Text>
              {todayAssignments.map((a, i) => (
                <View key={i} style={s.routineToday}>
                  <View style={s.routineTodayLeft}>
                    <View style={s.routineTodayIcon}>
                      <Text style={{ fontSize: 18 }}>🏋️</Text>
                    </View>
                    <View>
                      <Text style={s.routineTodayName}>{a.routine?.name ?? 'Rutina asignada'}</Text>
                      {a.note && <Text style={s.routineTodayNote}>{a.note}</Text>}
                    </View>
                  </View>
                  <View style={s.routineTodayBadge}>
                    <Text style={s.routineTodayBadgeText}>HOY</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Actividad de hoy — 4 métricas en fila ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionIcon}>〜</Text>
              <Text style={s.sectionTitle}>Actividad de hoy</Text>
              <TouchableOpacity style={s.sectionLink}>
                <Text style={s.sectionLinkText}>Ver detalles ›</Text>
              </TouchableOpacity>
            </View>
            <View style={s.metricsRow}>
              <MetricCard icon="🔥" label="Calorías"      value={calories.toString()}  unit="kcal"  color="#F97316" />
              <MetricCard icon="📍" label="Distancia"     value={distanceKm}            unit="km"    color="#6366F1" />
              <MetricCard icon="⏱️" label="Min activo"    value={activeMin.toString()}  unit="min"   color="#10B981" />
              <MetricCard icon="👣" label="Pasos"         value={stepsToday.toLocaleString()} unit="pasos" color={Colors.primary} />
            </View>
          </View>

          {/* ── Gráfica semanal ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionIcon}>📊</Text>
              <Text style={s.sectionTitle}>Pasos últimos 7 días</Text>
              <Text style={[s.sectionLinkText, { marginLeft: 'auto' }]}>
                Total: {totalWeekSteps.toLocaleString()}
              </Text>
            </View>
            <View style={s.chartCard}>
              <WeekBarChart data={weeklySteps} color={Colors.primary} />
              <View style={s.chartFooter}>
                <Text style={s.chartSub}>Media: {avgWeekSteps.toLocaleString()} pasos/día</Text>
              </View>
            </View>
          </View>

          {/* ── Próximas rutinas ── */}
          {upcomingAssignments.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionIcon}>📋</Text>
                <Text style={s.sectionTitle}>Próximas rutinas</Text>
                <TouchableOpacity style={{ marginLeft: 'auto' as any }}>
                  <Text style={s.sectionLinkText}>Ver todas ›</Text>
                </TouchableOpacity>
              </View>
              {upcomingAssignments.map((a, i) => {
                const d = new Date(a.date);
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <TouchableOpacity key={i} style={s.assignRow} activeOpacity={0.75}>
                    <View style={[s.assignDateBox, { backgroundColor: isToday ? Colors.primary : Colors.primaryLight }]}>
                      <Text style={[s.assignDay, { color: isToday ? '#fff' : Colors.primary }]}>
                        {d.getDate()}
                      </Text>
                      <Text style={[s.assignMonth, { color: isToday ? '#ffffffAA' : Colors.primary + 'AA' }]}>
                        {d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assignName}>{a.routine?.name ?? 'Rutina'}</Text>
                      <Text style={s.assignMeta}>
                        🕐 18:00 · {a.routine?.blocks?.flatMap((b: any) => b.exercises ?? []).length ?? 0} ejercicios
                      </Text>
                    </View>
                    <View style={s.assignArrowBox}>
                      <Text style={s.assignIcon}>🏋️</Text>
                      <Text style={s.assignArrow}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  hero: {
    width: '100%',
    paddingBottom: 24,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 2,
  },
  heroName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  heroDate: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryMid,
  },

  // Podómetro no disponible
  pedometerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  pedometerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedometerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  pedometerSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  pedometerArrow: {
    fontSize: 22,
    color: '#CBD5E1',
    fontWeight: '300',
  },

  // Pasos disponible
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  stepsLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5, marginBottom: 4 },
  stepsValue: { fontSize: 28, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  stepsProgressBg: {
    height: 6, backgroundColor: Colors.primaryLight,
    borderRadius: 99, overflow: 'hidden', marginBottom: 6,
  },
  stepsProgressFill: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: 99,
  },
  stepsGoal: { fontSize: 11, color: '#64748B' },

  // Body
  body: { padding: 20, gap: 8 },

  // Section
  section: { gap: 10, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionIcon: { fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  sectionLink: { marginLeft: 'auto' as any },
  sectionLinkText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

  // Rutina de hoy
  routineToday: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineTodayLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  routineTodayIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  routineTodayName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  routineTodayNote: { fontSize: 12, color: '#64748B', marginTop: 2 },
  routineTodayBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  routineTodayBadgeText: { fontSize: 11, fontWeight: '800', color: '#EAF3DE', letterSpacing: 0.5 },

  // 4 métricas en fila
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // Gráfica
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  chartFooter: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  chartSub: { fontSize: 12, color: '#64748B' },

  // Próximas rutinas
  assignRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assignDateBox: {
    width: 48, height: 48,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  assignDay:   { fontSize: 18, fontWeight: '800' },
  assignMonth: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  assignName:  { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  assignMeta:  { fontSize: 12, color: '#64748B', marginTop: 2 },
  assignArrowBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assignIcon: { fontSize: 22 },
  assignArrow: { fontSize: 20, color: '#CBD5E1', fontWeight: '300' },
});