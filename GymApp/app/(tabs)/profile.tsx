import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, SafeAreaView, ActivityIndicator,
  Switch, Alert, Platform, TextInput, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getMe, deleteToken, getMyWorkoutLogs } from '../../services/api';

const { width } = require('react-native').Dimensions.get('window');

// ─── Paleta ───────────────────────────────────────────────────────────────────
const P = {
  green:    '#3B6D11',
  greenMid: '#5A9E1A',
  greenLt:  '#EAF3DE',
  slate:    '#0F172A',
  slateCard:'#1E293B',
  border:   '#334155',
  textDim:  '#94A3B8',
  red:      '#EF4444',
  yellow:   '#F59E0B',
  blue:     '#3B82F6',
  purple:   '#8B5CF6',
};

const EXERCISE_COLORS = [P.green, P.blue, P.yellow, P.purple, '#EC4899', '#14B8A6', '#F97316'];

// ─── Gráfica de línea de progreso ─────────────────────────────────────────────
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
        <Text style={{ color: isDark ? P.textDim : '#94A3B8', fontSize: 12 }}>
          Registra más entrenamientos para ver tu progreso
        </Text>
      </View>
    );
  }

  const W = width - 80;
  const H = 90;
  const pad = 12;
  const vals = data.map(d => d.kg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const step = (W - pad * 2) / (data.length - 1);

  const toX = (i: number) => pad + i * step;
  const toY = (v: number) => pad + ((max - v) / range) * (H - pad * 2);

  const points = data.map((d, i) => `${toX(i)},${toY(d.kg)}`).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const diff = last.kg - first.kg;
  const diffColor = diff >= 0 ? P.green : P.red;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: isDark ? P.textDim : '#64748B' }}>
          {data.length} registros
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '700', color: diffColor }}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(1)} kg
        </Text>
      </View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id={`grad_${color}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Grid lines */}
        {[0, 0.5, 1].map((t, i) => (
          <Line
            key={i}
            x1={pad} y1={pad + t * (H - pad * 2)}
            x2={W - pad} y2={pad + t * (H - pad * 2)}
            stroke={isDark ? '#1E293B' : '#F1F5F9'}
            strokeWidth={1}
          />
        ))}
        {/* Línea */}
        <Polyline
          points={points}
          fill="none"
          stroke={`url(#grad_${color})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Puntos */}
        {data.map((d, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(d.kg)} r={3} fill={color} />
        ))}
        {/* Punto final destacado */}
        <Circle cx={toX(data.length - 1)} cy={toY(last.kg)} r={6} fill={color + '33'} />
        <Circle cx={toX(data.length - 1)} cy={toY(last.kg)} r={3.5} fill={color} />
        {/* Valor actual */}
        <SvgText
          x={toX(data.length - 1)}
          y={toY(last.kg) - 10}
          fontSize="10"
          fontWeight="700"
          fill={color}
          textAnchor="middle"
        >
          {last.kg}kg
        </SvgText>
      </Svg>
    </View>
  );
}

// ─── Tarjeta de stat ──────────────────────────────────────────────────────────
function StatCard({ icon, value, label, color, isDark }: {
  icon: string; value: string; label: string; color: string; isDark: boolean;
}) {
  return (
    <View style={[sc.card, {
      backgroundColor: isDark ? P.slateCard : '#FFFFFF',
      borderColor: isDark ? P.border : '#E2E8F0',
    }]}>
      <View style={[sc.iconBox, { backgroundColor: color + '18' }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <Text style={[sc.value, { color: isDark ? '#F1F5F9' : '#1A1A1A' }]}>{value}</Text>
      <Text style={[sc.label, { color: isDark ? P.textDim : '#64748B' }]}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, borderWidth: 0.5, padding: 14, gap: 6, alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

// ─── Fila de ajuste ───────────────────────────────────────────────────────────
function SettingRow({ icon, label, sub, right, onPress, isDark }: {
  icon: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; isDark: boolean;
}) {
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={[sr.row, { borderBottomColor: isDark ? P.border : '#F1F5F9' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[sr.iconBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[sr.label, { color: isDark ? '#F1F5F9' : '#1A1A1A' }]}>{label}</Text>
        {sub && <Text style={[sr.sub, { color: isDark ? P.textDim : '#64748B' }]}>{sub}</Text>}
      </View>
      {right ?? <Text style={{ color: isDark ? P.textDim : '#CBD5E1', fontSize: 16 }}>›</Text>}
    </Wrap>
  );
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 11, marginTop: 1 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const C = {
    bg:      isDark ? '#0F172A' : '#F5F7FA',
    surface: isDark ? P.slateCard : '#FFFFFF',
    text:    isDark ? '#F1F5F9' : '#1A1A1A',
    textSub: isDark ? P.textDim : '#64748B',
    border:  isDark ? P.border : '#E2E8F0',
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

  useEffect(() => {
    loadData();
  }, []);

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

  // ── Procesar logs por ejercicio ───────────────────────────────────────────
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

  // ── Stats globales ────────────────────────────────────────────────────────
  const totalSessions = new Set(logs.map((l: any) => l.assignment_id)).size;
  const totalKg = logs.reduce((s: number, l: any) => s + Number(l.kg ?? 0) * Number(l.reps ?? 1), 0);
  const maxKgEver = Math.max(...logs.map((l: any) => Number(l.kg ?? 0)), 0);

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
              <TouchableOpacity style={[s.modalBtnCancel, { borderColor: C.border }]} onPress={() => setEditModal(false)}>
                <Text style={{ color: C.textSub, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnOk, { backgroundColor: Colors.primary }]}
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
            HERO DEL PERFIL
        ════════════════════════════ */}
        <View style={[s.hero, { backgroundColor: Colors.primary }]}>
          {/* Avatar */}
          <TouchableOpacity style={s.avatarWrap} onPress={pickPhoto} activeOpacity={0.85}>
            {photoUri ? (
              <View style={s.avatarImg}>
                {/* En producción usarías <Image source={{ uri: photoUri }} style={s.avatarImg} /> */}
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={s.avatarEditBadge}>
              <Text style={{ fontSize: 12 }}>📷</Text>
            </View>
          </TouchableOpacity>

          {/* Info */}
          <View style={s.heroInfo}>
            <TouchableOpacity onPress={() => setEditModal(true)} style={s.nameRow}>
              <Text style={s.heroName}>{user?.name ?? 'Usuario'}</Text>
              <View style={s.editBadge}>
                <Text style={{ fontSize: 10, color: Colors.primaryLight }}>✏️ editar</Text>
              </View>
            </TouchableOpacity>
            <Text style={s.heroEmail}>{user?.email ?? ''}</Text>
            <View style={[s.roleBadge, { backgroundColor: user?.role === 'admin' ? '#FFD60A22' : '#FFFFFF22' }]}>
              <Text style={[s.roleText, { color: user?.role === 'admin' ? '#FFD60A' : '#FFFFFF99' }]}>
                {user?.role === 'admin' ? '⭐ Entrenador' : '💪 Atleta'}
              </Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════
            STATS
        ════════════════════════════ */}
        <View style={[s.section, { paddingHorizontal: 16, marginTop: 20 }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>📊 Resumen</Text>
          <View style={s.statsRow}>
            <StatCard icon="🏋️" value={String(totalSessions)} label="Sesiones" color={Colors.primary} isDark={isDark} />
            <StatCard icon="🔥" value={`${(totalKg / 1000).toFixed(1)}t`} label="Volumen total" color="#F97316" isDark={isDark} />
            <StatCard icon="🏆" value={`${maxKgEver}kg`} label="Mejor marca" color="#F59E0B" isDark={isDark} />
          </View>
        </View>

        {/* ════════════════════════════
            PROGRESO DE PESOS
        ════════════════════════════ */}
        <View style={[s.section, { paddingHorizontal: 16 }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: C.text }]}>📈 Progreso de pesos</Text>
            <Text style={[s.sectionSub, { color: C.textSub }]}>{exerciseList.length} ejercicios</Text>
          </View>

          {exerciseList.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={{ fontSize: 36 }}>📋</Text>
              <Text style={[s.emptyTitle, { color: C.text }]}>Sin registros aún</Text>
              <Text style={[s.emptySub, { color: C.textSub }]}>
                Cuando registres pesos en el calendario aparecerá tu progreso aquí
              </Text>
            </View>
          ) : (
            <View style={[s.progressCard, { backgroundColor: C.surface, borderColor: C.border }]}>

              {/* Selector de ejercicio */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.exSelector}>
                {exerciseList.map((ex, i) => {
                  const color = EXERCISE_COLORS[i % EXERCISE_COLORS.length];
                  const active = (selectedExercise ?? exerciseList[0]?.name) === ex.name;
                  return (
                    <TouchableOpacity
                      key={ex.name}
                      style={[s.exChip, { borderColor: active ? color : C.border, backgroundColor: active ? color + '18' : 'transparent' }]}
                      onPress={() => setSelectedExercise(ex.name)}
                    >
                      <View style={[s.exChipDot, { backgroundColor: color }]} />
                      <Text style={[s.exChipText, { color: active ? color : C.textSub }]} numberOfLines={1}>
                        {ex.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Gráfica */}
              {currentExercise && (
                <View style={{ gap: 12 }}>
                  <View style={s.exStatRow}>
                    <View style={s.exStatItem}>
                      <Text style={[s.exStatVal, { color: Colors.primary }]}>{currentExercise.maxKg}kg</Text>
                      <Text style={[s.exStatLbl, { color: C.textSub }]}>Máximo</Text>
                    </View>
                    <View style={s.exStatItem}>
                      <Text style={[s.exStatVal, { color: P.blue }]}>
                        {(currentExercise.data.reduce((s, d) => s + d.kg, 0) / currentExercise.data.length).toFixed(1)}kg
                      </Text>
                      <Text style={[s.exStatLbl, { color: C.textSub }]}>Media</Text>
                    </View>
                    <View style={s.exStatItem}>
                      <Text style={[s.exStatVal, { color: P.yellow }]}>{currentExercise.data.length}</Text>
                      <Text style={[s.exStatLbl, { color: C.textSub }]}>Registros</Text>
                    </View>
                  </View>

                  <ProgressChart
                    data={currentExercise.data}
                    color={EXERCISE_COLORS[exerciseList.findIndex(e => e.name === currentExercise.name) % EXERCISE_COLORS.length]}
                    isDark={isDark}
                  />
                </View>
              )}

              {/* Tabla de máximos */}
              <View style={[s.maxTable, { borderTopColor: C.border }]}>
                <Text style={[s.maxTableTitle, { color: C.textSub }]}>🏆 Mejores marcas</Text>
                {exerciseList.slice(0, 5).map((ex, i) => (
                  <View key={ex.name} style={[s.maxRow, { borderBottomColor: C.border }]}>
                    <View style={[s.maxDot, { backgroundColor: EXERCISE_COLORS[i % EXERCISE_COLORS.length] }]} />
                    <Text style={[s.maxName, { color: C.text }]} numberOfLines={1}>{ex.name}</Text>
                    <Text style={[s.maxKg, { color: EXERCISE_COLORS[i % EXERCISE_COLORS.length] }]}>
                      {ex.maxKg} kg
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ════════════════════════════
            AJUSTES
        ════════════════════════════ */}
        <View style={[s.section, { paddingHorizontal: 16 }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>⚙️ Ajustes</Text>
          <View style={[s.settingsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <SettingRow
              icon="🔔"
              label="Notificaciones"
              sub="Avisos de nuevas rutinas"
              right={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: C.border, true: Colors.primary + '88' }}
                  thumbColor={notifications ? Colors.primary : '#ccc'}
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
                  trackColor={{ false: C.border, true: Colors.primary + '88' }}
                  thumbColor={darkMode ? Colors.primary : '#ccc'}
                />
              }
              isDark={isDark}
            />
            <SettingRow
              icon="🔒"
              label="Cambiar contraseña"
              sub="Última actualización: nunca"
              onPress={() => Alert.alert('Próximamente', 'Esta función estará disponible pronto')}
              isDark={isDark}
            />
            <SettingRow
              icon="📊"
              label="Exportar datos"
              sub="Descarga tu historial de entrenamientos"
              onPress={() => Alert.alert('Próximamente', 'Exportación de datos disponible pronto')}
              isDark={isDark}
            />
            <SettingRow
              icon="❓"
              label="Ayuda y soporte"
              onPress={() => Alert.alert('Soporte', 'Contacta con tu entrenador para cualquier duda')}
              isDark={isDark}
            />
          </View>
        </View>

        {/* ── Versión ── */}
        <Text style={[s.version, { color: C.textSub }]}>Red de Vida v1.0.0</Text>

        {/* ── Cerrar sesión ── */}
        <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
          <TouchableOpacity
            style={[s.logoutBtn, { borderColor: P.red + '44', backgroundColor: P.red + '08' }]}
            onPress={handleLogout}
          >
            <Text style={{ fontSize: 18 }}>🚪</Text>
            <Text style={[s.logoutText, { color: P.red }]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Hero
  hero: { paddingTop: 28, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primaryDark ?? '#2A5009',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarImg: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primaryDark ?? '#2A5009',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.primary,
  },
  heroInfo: { alignItems: 'center', gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  editBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroEmail: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700' },

  // Sections
  section: { gap: 12, marginBottom: 8, marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSub: { fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },

  // Progress card
  progressCard: { borderRadius: 20, borderWidth: 0.5, padding: 16, gap: 16 },
  exSelector: { gap: 8, paddingBottom: 4 },
  exChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  exChipDot: { width: 7, height: 7, borderRadius: 4 },
  exChipText: { fontSize: 12, fontWeight: '600', maxWidth: 120 },
  exStatRow: { flexDirection: 'row', justifyContent: 'space-around' },
  exStatItem: { alignItems: 'center', gap: 2 },
  exStatVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  exStatLbl: { fontSize: 10, fontWeight: '600' },

  // Tabla máximos
  maxTable: { borderTopWidth: 0.5, paddingTop: 14, gap: 10 },
  maxTableTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  maxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottomWidth: 0.5 },
  maxDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  maxName: { flex: 1, fontSize: 13, fontWeight: '600' },
  maxKg: { fontSize: 15, fontWeight: '800' },

  // Settings
  settingsCard: { borderRadius: 20, borderWidth: 0.5, paddingHorizontal: 16, overflow: 'hidden' },

  // Empty
  emptyCard: { borderRadius: 20, borderWidth: 0.5, padding: 32, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Logout
  logoutBtn: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoutText: { fontSize: 15, fontWeight: '700' },

  version: { fontSize: 11, textAlign: 'center', marginBottom: 8, marginTop: 4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { borderRadius: 20, borderWidth: 0.5, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 0.5, borderRadius: 12, padding: 14, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: { flex: 1, borderWidth: 0.5, borderRadius: 12, padding: 13, alignItems: 'center' },
  modalBtnOk: { flex: 1, borderRadius: 12, padding: 13, alignItems: 'center' },
});