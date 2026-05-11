import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, SafeAreaView, ActivityIndicator,
  Switch, Alert, Platform, TextInput, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getMe, deleteToken, getMyWorkoutLogs } from '../../services/api';

const { width } = require('react-native').Dimensions.get('window');

// ─── Paleta ───────────────────────────────────────────────────────────────────
const P = {
  green:     '#3B6D11',
  greenMid:  '#5A9E1A',
  greenLt:   '#EAF3DE',
  bgCream:   '#F0EDE6',
  slate:     '#0F172A',
  slateCard: '#1E293B',
  border:    '#E5E2DB',
  borderDark:'#334155',
  textDim:   '#94A3B8',
  textSub:   '#64748B',
  red:       '#EF4444',
  yellow:    '#F59E0B',
  blue:      '#3B82F6',
  purple:    '#8B5CF6',
  orange:    '#F97316',
  pink:      '#EC4899',
};

const EXERCISE_COLORS = [P.green, P.blue, P.yellow, P.purple, P.pink, '#14B8A6', P.orange];

// ─── Gráfica de progreso con ejes ─────────────────────────────────────────────
function ProgressChart({
  data, color, isDark,
}: {
  data: { date: string; kg: number }[];
  color: string;
  isDark: boolean;
}) {
  if (data.length < 2) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text style={{ color: P.textDim, fontSize: 12 }}>
          Registra más entrenamientos para ver tu progreso
        </Text>
      </View>
    );
  }

  const W = width - 130; // espacio para eje Y
  const H = 130;
  const padL = 8;
  const padR = 12;
  const padT = 20;
  const padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const vals = data.map(d => d.kg);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const step = chartW / (data.length - 1);

  const toX = (i: number) => padL + i * step;
  const toY = (v: number) => padT + ((maxV - v) / range) * chartH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.kg)}`).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const diff = last.kg - first.kg;

  // etiquetas eje Y (4 líneas)
  const yLabels = [maxV, maxV * 0.75, maxV * 0.5, maxV * 0.25, 0];
  // etiquetas eje X (mostrar algunas)
  const xLabels = data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1);

  const diffColor = diff >= 0 ? P.green : P.red;

  return (
    <View>
      <Svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Grid horizontales */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <Line
            key={i}
            x1={padL} y1={padT + t * chartH}
            x2={padL + chartW} y2={padT + t * chartH}
            stroke={isDark ? '#334155' : '#F0EDE6'}
            strokeWidth={1}
          />
        ))}

        {/* Línea de progreso */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Puntos */}
        {data.map((d, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(d.kg)} r={4} fill={color} />
        ))}

        {/* Punto final destacado */}
        <Circle cx={toX(data.length - 1)} cy={toY(last.kg)} r={8} fill={color + '33'} />
        <Circle cx={toX(data.length - 1)} cy={toY(last.kg)} r={4} fill={color} />

        {/* Etiqueta final flotante */}
        <Rect
          x={toX(data.length - 1) - 22}
          y={toY(last.kg) - 22}
          width={44}
          height={16}
          rx={5}
          fill={color}
        />
        <SvgText
          x={toX(data.length - 1)}
          y={toY(last.kg) - 10}
          fontSize="9"
          fontWeight="700"
          fill="#fff"
          textAnchor="middle"
        >
          {last.kg} kg
        </SvgText>

        {/* Etiquetas eje X */}
        {data.map((d, i) => {
          const showLabel = i % Math.ceil(data.length / 5) === 0 || i === data.length - 1;
          if (!showLabel) return null;
          const parts = d.date.split('-');
          const label = parts.length === 3
            ? `${parseInt(parts[2])} ${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(parts[1]) - 1]}`
            : d.date;
          return (
            <SvgText
              key={`xl-${i}`}
              x={toX(i)}
              y={H - 2}
              fontSize="8"
              fill={P.textDim}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Eje Y (fuera del SVG, a la izquierda del chart) */}
    </View>
  );
}

// ─── Tarjeta de stat (horizontal: icono + valor + label) ──────────────────────
function StatCard({ icon, value, valueSuffix, label, sublabel, color, isDark }: {
  icon: string; value: string; valueSuffix?: string; label: string; sublabel?: string;
  color: string; isDark: boolean;
}) {
  const bg = isDark ? P.slateCard : '#FFFFFF';
  const borderC = isDark ? P.borderDark : P.border;
  const textC = isDark ? '#F1F5F9' : '#1A1A1A';
  const subC = isDark ? P.textDim : P.textSub;

  return (
    <View style={[sc.card, { backgroundColor: bg, borderColor: borderC }]}>
      <View style={[sc.iconBox, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={sc.info}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
          <Text style={[sc.value, { color: textC }]}>{value}</Text>
          {valueSuffix && <Text style={[sc.suffix, { color: subC }]}>{valueSuffix}</Text>}
        </View>
        <Text style={[sc.label, { color: subC }]}>{label}</Text>
        {sublabel && <Text style={[sc.sublabel, { color: color }]}>{sublabel}</Text>}
      </View>
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 14, borderWidth: 0.5,
    padding: 12, gap: 8, alignItems: 'center',
  },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  info: { alignItems: 'center', gap: 2 },
  value: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  suffix: { fontSize: 11, fontWeight: '600' },
  label: { fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  sublabel: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
});

// ─── Fila de ajuste ───────────────────────────────────────────────────────────
function SettingRow({ icon, label, sub, right, onPress, isDark }: {
  icon: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; isDark: boolean;
}) {
  const Wrap = onPress ? TouchableOpacity : View;
  const borderC = isDark ? P.borderDark : '#F1F5F9';
  const iconBg = isDark ? '#1E293B' : '#F8FAFC';
  const textC = isDark ? '#F1F5F9' : '#1A1A1A';
  const subC = isDark ? P.textDim : P.textSub;

  return (
    <Wrap
      style={[sr.row, { borderBottomColor: borderC }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[sr.iconBox, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sr.label, { color: textC }]}>{label}</Text>
        {sub && <Text style={[sr.sub, { color: subC }]}>{sub}</Text>}
      </View>
      {right ?? <Text style={{ color: isDark ? P.textDim : '#CBD5E1', fontSize: 18 }}>›</Text>}
    </Wrap>
  );
}
const sr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 0.5,
  },
  iconBox: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 11, marginTop: 1 },
});

// ─── Fila de mejor marca ──────────────────────────────────────────────────────
function RecordRow({ name, kg, color, isDark }: {
  name: string; kg: number; color: string; isDark: boolean;
}) {
  const textC = isDark ? '#F1F5F9' : '#1A1A1A';
  const borderC = isDark ? P.borderDark : '#F1F5F9';
  return (
    <View style={[rr.row, { borderBottomColor: borderC }]}>
      <View style={[rr.dot, { backgroundColor: color }]} />
      <Text style={{ fontSize: 18 }}>🏋️</Text>
      <Text style={[rr.name, { color: textC }]} numberOfLines={1}>{name}</Text>
      <Text style={[rr.kg, { color }]}>{kg} kg</Text>
      <Text style={{ color: isDark ? P.textDim : '#CBD5E1', fontSize: 16 }}>›</Text>
    </View>
  );
}
const rr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  name: { flex: 1, fontSize: 13, fontWeight: '600' },
  kg: { fontSize: 14, fontWeight: '800' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const C = {
    bg:      isDark ? '#0F172A' : P.bgCream,
    surface: isDark ? P.slateCard : '#FFFFFF',
    text:    isDark ? '#F1F5F9' : '#1A1A1A',
    textSub: isDark ? P.textDim : P.textSub,
    border:  isDark ? P.borderDark : P.border,
  };

  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(isDark);
  const [notifications, setNotifications] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me);
      setEditName(me?.name ?? '');
      try {
        const logsData = await getMyWorkoutLogs();
        setLogs(logsData ?? []);
      } catch { setLogs([]); }
    } catch {}
    finally { setLoading(false); }
  };

  // ── Procesar logs ─────────────────────────────────────────────────────────
  const exerciseProgress: Record<string, { name: string; data: { date: string; kg: number }[]; maxKg: number }> = {};
  logs.forEach((log: any) => {
    const name = log.exercise?.name ?? log.exercise_name ?? `Ejercicio ${log.exercise_id}`;
    const kg = Number(log.kg ?? 0);
    const date = log.date ?? log.created_at?.split('T')[0] ?? '';
    if (!exerciseProgress[name]) exerciseProgress[name] = { name, data: [], maxKg: 0 };
    exerciseProgress[name].data.push({ date, kg });
    if (kg > exerciseProgress[name].maxKg) exerciseProgress[name].maxKg = kg;
  });

  const exerciseList = Object.values(exerciseProgress).sort((a, b) => b.data.length - a.data.length);
  const currentExercise = selectedExercise
    ? exerciseProgress[selectedExercise]
    : exerciseList[0] ?? null;
  const currentColor = EXERCISE_COLORS[
    exerciseList.findIndex(e => e.name === currentExercise?.name) % EXERCISE_COLORS.length
  ] ?? P.green;

  // ── Stats globales ────────────────────────────────────────────────────────
  const totalSessions = new Set(logs.map((l: any) => l.assignment_id)).size;
  const totalKg = logs.reduce((s: number, l: any) => s + Number(l.kg ?? 0) * Number(l.reps ?? 1), 0);
  const maxKgEver = Math.max(...logs.map((l: any) => Number(l.kg ?? 0)), 0);
  const topExercise = exerciseList[0]?.name ?? '';

  // ── Foto ──────────────────────────────────────────────────────────────────
  const pickPhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Foto', 'Cambio de foto disponible en dispositivo móvil');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso necesario'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => {
        await deleteToken();
        router.replace('/auth/login');
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>

      {/* ── Modal editar nombre ── */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.modalTitle, { color: C.text }]}>Editar nombre</Text>
            <TextInput
              style={[s.modalInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
              value={editName}
              onChangeText={setEditName}
              autoFocus
              placeholder="Tu nombre"
              placeholderTextColor={C.textSub}
            />
            <View style={s.modalBtns}>
              <TouchableOpacity
                style={[s.modalBtnCancel, { borderColor: C.border }]}
                onPress={() => setEditModal(false)}
              >
                <Text style={{ color: C.textSub, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnOk, { backgroundColor: P.green }]}
                onPress={() => {
                  setUser((p: any) => ({ ...p, name: editName }));
                  setEditModal(false);
                  Alert.alert('✓ Nombre actualizado');
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ════════════════════════════
            HERO — layout horizontal
        ════════════════════════════ */}
        <View style={[s.hero, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          {/* Hojas decorativas */}
          <View style={s.leavesDecor} pointerEvents="none">
            <View style={[s.leaf, { width: 60, height: 28, top: -8, right: 10, transform: [{ rotate: '-30deg' }], backgroundColor: P.green, opacity: 0.12 }]} />
            <View style={[s.leaf, { width: 48, height: 22, top: 14, right: 30, transform: [{ rotate: '-15deg' }], backgroundColor: P.greenMid, opacity: 0.10 }]} />
            <View style={[s.leaf, { width: 38, height: 18, top: 30, right: 6, transform: [{ rotate: '10deg' }], backgroundColor: P.green, opacity: 0.08 }]} />
          </View>

          {/* Avatar */}
          <TouchableOpacity style={s.avatarWrap} onPress={pickPhoto} activeOpacity={0.85}>
            <View style={s.avatarCircle}>
              <Text style={s.avatarInitials}>{initials}</Text>
            </View>
            <View style={[s.camBadge, { borderColor: P.green }]}>
              <Text style={{ fontSize: 11 }}>📷</Text>
            </View>
          </TouchableOpacity>

          {/* Info */}
          <View style={s.heroInfo}>
            {/* Nombre + editar */}
            <View style={s.nameRow}>
              <Text style={[s.heroName, { color: C.text }]}>{user?.name ?? 'Usuario'}</Text>
              <TouchableOpacity
                style={[s.editBtn, { borderColor: C.border }]}
                onPress={() => setEditModal(true)}
              >
                <Text style={{ fontSize: 10 }}>✏️</Text>
                <Text style={[s.editBtnText, { color: C.textSub }]}>Editar perfil</Text>
              </TouchableOpacity>
            </View>

            {/* Email */}
            <Text style={[s.heroEmail, { color: C.textSub }]}>{user?.email ?? ''}</Text>

            {/* Badge rol */}
            <View style={[s.roleBadge, { borderColor: C.border, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
              <Text style={[s.roleText, { color: user?.role === 'admin' ? P.yellow : C.textSub }]}>
                {user?.role === 'admin' ? '⭐ Entrenador' : '💪 Atleta'}
              </Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════
            RESUMEN
        ════════════════════════════ */}
        <View style={[s.card, { marginTop: 12, marginHorizontal: 12, backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.cardHeader}>
            <Text style={{ fontSize: 16 }}>📊</Text>
            <Text style={[s.cardTitle, { color: C.text }]}>Resumen</Text>
          </View>
          <View style={s.statsRow}>
            <StatCard
              icon="📅"
              value={String(totalSessions)}
              label={`Sesiones\nesta semana`}
              color={P.green}
              isDark={isDark}
            />
            <StatCard
              icon="🏋️"
              value={(totalKg / 1000).toFixed(1)}
              valueSuffix=" t"
              label={`Carga total\nesta semana`}
              color={P.orange}
              isDark={isDark}
            />
            <StatCard
              icon="🏆"
              value={String(maxKgEver)}
              valueSuffix=" kg"
              label={`Mejor marca`}
              sublabel={topExercise ? topExercise.split(' ').slice(0, 2).join(' ') : ''}
              color={P.yellow}
              isDark={isDark}
            />
          </View>
        </View>

        {/* ════════════════════════════
            PROGRESO DE PESOS
        ════════════════════════════ */}
        <View style={[s.card, { marginTop: 10, marginHorizontal: 12, backgroundColor: C.surface, borderColor: C.border }]}>
          {/* Cabecera */}
          <View style={[s.cardHeader, { justifyContent: 'space-between' }]}>
            <View style={s.cardHeader}>
              <Text style={{ fontSize: 16 }}>📈</Text>
              <Text style={[s.cardTitle, { color: C.text }]}>Progreso de pesos</Text>
            </View>
            <TouchableOpacity style={[s.periodBtn, { borderColor: C.border }]}>
              <Text style={[s.periodBtnText, { color: C.textSub }]}>6 meses</Text>
              <Text style={{ color: C.textSub, fontSize: 12 }}>▾</Text>
            </TouchableOpacity>
          </View>

          {exerciseList.length === 0 ? (
            <View style={[s.emptyCard, { borderColor: C.border }]}>
              <Text style={{ fontSize: 36 }}>📋</Text>
              <Text style={[s.emptyTitle, { color: C.text }]}>Sin registros aún</Text>
              <Text style={[s.emptySub, { color: C.textSub }]}>
                Cuando registres pesos en el calendario aparecerá tu progreso aquí
              </Text>
            </View>
          ) : (
            <>
              {/* Selector ejercicio */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.exSelector}>
                {exerciseList.map((ex, i) => {
                  const color = EXERCISE_COLORS[i % EXERCISE_COLORS.length];
                  const active = (selectedExercise ?? exerciseList[0]?.name) === ex.name;
                  return (
                    <TouchableOpacity
                      key={ex.name}
                      style={[s.exChip, {
                        borderColor: active ? color : C.border,
                        backgroundColor: active ? color + '18' : 'transparent',
                      }]}
                      onPress={() => setSelectedExercise(ex.name)}
                    >
                      <View style={[s.exChipDot, { backgroundColor: color }]} />
                      <Text style={[s.exChipText, { color: active ? color : C.textSub }]} numberOfLines={1}>
                        {ex.name}
                      </Text>
                      <Text style={{ color: active ? color : C.textSub, fontSize: 10 }}>▾</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Zona gráfica + meta-info */}
              {currentExercise && (() => {
                const lastKg = currentExercise.data[currentExercise.data.length - 1]?.kg ?? 0;
                const firstKg = currentExercise.data[0]?.kg ?? 0;
                const diff = lastKg - firstKg;
                const lastDate = currentExercise.data[currentExercise.data.length - 1]?.date ?? '';
                return (
                  <View style={s.chartRow}>
                    {/* Meta izquierda */}
                    <View style={s.chartMeta}>
                      <View style={{ marginBottom: 16 }}>
                        <Text style={[s.metaLabel, { color: C.textSub }]}>Mejor marca</Text>
                        <Text style={[s.metaVal, { color: P.green }]}>{currentExercise.maxKg} kg</Text>
                      </View>
                      <View>
                        <Text style={[s.metaLabel, { color: C.textSub }]}>Último registro</Text>
                        <Text style={[s.metaVal, { color: diff >= 0 ? P.green : P.red }]}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(1)} kg
                        </Text>
                        <Text style={[s.metaSub, { color: C.textSub }]}>Hace 2 días</Text>
                      </View>
                    </View>

                    {/* Gráfica */}
                    <ProgressChart
                      data={currentExercise.data}
                      color={currentColor}
                      isDark={isDark}
                    />
                  </View>
                );
              })()}
            </>
          )}
        </View>

        {/* ════════════════════════════
            MEJORES MARCAS
        ════════════════════════════ */}
        {exerciseList.length > 0 && (
          <View style={[s.card, { marginTop: 10, marginHorizontal: 12, backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.cardHeader}>
              <Text style={{ fontSize: 16 }}>🏆</Text>
              <Text style={[s.cardTitle, { color: C.text }]}>Mejores marcas</Text>
            </View>
            {exerciseList.slice(0, 5).map((ex, i) => (
              <RecordRow
                key={ex.name}
                name={ex.name}
                kg={ex.maxKg}
                color={EXERCISE_COLORS[i % EXERCISE_COLORS.length]}
                isDark={isDark}
              />
            ))}
          </View>
        )}

        {/* ════════════════════════════
            AJUSTES
        ════════════════════════════ */}
        <View style={[s.card, { marginTop: 10, marginHorizontal: 12, backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.cardHeader}>
            <Text style={{ fontSize: 16 }}>⚙️</Text>
            <Text style={[s.cardTitle, { color: C.text }]}>Ajustes</Text>
          </View>
          <SettingRow
            icon="🔔"
            label="Notificaciones"
            sub="Avisos de nuevas rutinas y recordatorios"
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: C.border, true: P.green + '88' }}
                thumbColor={notifications ? P.green : '#ccc'}
              />
            }
            isDark={isDark}
          />
          <SettingRow
            icon="🌙"
            label="Tema oscuro"
            sub="Activado automáticamente por el sistema"
            right={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: C.border, true: P.green + '88' }}
                thumbColor={darkMode ? P.green : '#ccc'}
              />
            }
            isDark={isDark}
          />
          <SettingRow
            icon="ℹ️"
            label="Acerca de la app"
            sub="Red de Vida v1.0.0"
            onPress={() => Alert.alert('Red de Vida', 'Versión 1.0.0')}
            isDark={isDark}
          />
        </View>

        {/* ── Cerrar sesión ── */}
        <TouchableOpacity
          style={[s.logoutBtn, { borderColor: P.red + '44', backgroundColor: P.red + '08' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 17 }}>🚪</Text>
          <Text style={[s.logoutText, { color: P.red }]}>Cerrar sesión</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero horizontal
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomWidth: 0.5,
    position: 'relative',
    overflow: 'hidden',
  },
  leavesDecor: { position: 'absolute', top: 0, right: 0, width: 120, height: 90 },
  leaf: { position: 'absolute', borderRadius: 100 },

  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatarCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: P.green,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: P.greenLt,
  },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  camBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },

  heroInfo: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  heroName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  editBtnText: { fontSize: 11, fontWeight: '500' },
  heroEmail: { fontSize: 12 },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  roleText: { fontSize: 12, fontWeight: '600' },

  // Card genérica
  card: {
    borderRadius: 16, borderWidth: 0.5,
    padding: 16, gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8 },

  // Period selector
  periodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  periodBtnText: { fontSize: 12 },

  // Exercise selector
  exSelector: { gap: 8, paddingBottom: 2 },
  exChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5,
  },
  exChipDot: { width: 7, height: 7, borderRadius: 4 },
  exChipText: { fontSize: 12, fontWeight: '600', maxWidth: 110 },

  // Chart row
  chartRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chartMeta: { width: 90, paddingTop: 16 },
  metaLabel: { fontSize: 10, fontWeight: '500', marginBottom: 2 },
  metaVal: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  metaSub: { fontSize: 10, marginTop: 2 },

  // Empty
  emptyCard: { borderRadius: 16, borderWidth: 0.5, padding: 28, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Logout
  logoutBtn: {
    marginHorizontal: 12, marginTop: 10, marginBottom: 16,
    borderRadius: 16, borderWidth: 1.5, padding: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  logoutText: { fontSize: 14, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { borderRadius: 20, borderWidth: 0.5, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 0.5, borderRadius: 12, padding: 14, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: { flex: 1, borderWidth: 0.5, borderRadius: 12, padding: 13, alignItems: 'center' },
  modalBtnOk: { flex: 1, borderRadius: 12, padding: 13, alignItems: 'center' },
});