import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator,
  Switch, Alert, Platform, TextInput, Modal, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import {
  Bell, Moon, Lock, Download, Info, Camera, LogOut, ChevronRight, Pencil,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getMe, deleteToken, getMyWorkoutLogs } from '../../services/api';

const { width } = Dimensions.get('window');

// Mismas fuentes que la pantalla de calendario
const FC  = 'BarlowCondensed-ExtraBold';
const FB  = 'Barlow-Regular';
const FBB = 'Barlow-Bold';

// ─── Paleta ───────────────────────────────────────────────────────────────────
const P = {
  green:    '#3B6D11',
  greenMid: '#5A9E1A',
  greenLt:  '#EAF3DE',
  slate:    '#0F172A',
  slateCard:'#1E293B',
  border:   '#334155',
  textDim:  '#94A3B8',
  red:      '#C4242A',
  yellow:   '#F59E0B',
  blue:     '#3B82F6',
  purple:   '#8B5CF6',
};

const EXERCISE_COLORS = [P.green, P.blue, P.yellow, P.purple, '#EC4899', '#14B8A6', '#F97316'];

// Paleta compartida con el calendario (misma ground, superficie y bordes)
const makePalette = (isDark: boolean) => ({
  bg:      isDark ? '#111111' : '#F2F5EE',
  surface: isDark ? '#1A1A1A' : '#FFFFFF',
  text:    isDark ? '#F2F2F0' : '#1A1A1A',
  textSub: isDark ? '#A1A1A0' : '#5F5E5A',
  border:  isDark ? '#2A2A2A' : '#E3E6DD',
});

// "1.2t" -> { num: '1.2', unit: 't' } para pintar la unidad más pequeña y en gris
const splitUnit = (v: string) => {
  const m = String(v).match(/^(-?[\d.,]+)(.*)$/);
  return m ? { num: m[1], unit: m[2] } : { num: String(v), unit: '' };
};

// ─── Gráfica de línea de progreso ─────────────────────────────────────────────
function ProgressChart({
  data, color, isDark,
}: {
  data: { date: string; kg: number }[];
  color: string;
  isDark: boolean;
}) {
  const C = makePalette(isDark);

  if (data.length < 2) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Text style={{ color: C.textSub, fontSize: 13, fontFamily: FB, textAlign: 'center' }}>
          Registra más entrenamientos para ver tu progreso
        </Text>
      </View>
    );
  }

  const W = width - 80;
  const H = 110;
  const padL = 36;   // carril para las marcas del eje Y
  const padR = 14;
  const padT = 20;
  const padB = 10;
  const vals = data.map(d => d.kg);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min;
  const step = (W - padL - padR) / (data.length - 1);

  const toX = (i: number) => padL + i * step;
  const toY = (v: number) =>
    range === 0 ? padT + (H - padT - padB) / 2 : padT + ((max - v) / range) * (H - padT - padB);

  const points = data.map((d, i) => `${toX(i)},${toY(d.kg)}`).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const diff = last.kg - first.kg;
  const good = isDark ? P.greenMid : P.green;
  const bad  = isDark ? '#E5566F' : P.red;
  const diffColor = diff >= 0 ? good : bad;
  const fmt = (v: number) => String(Number(v.toFixed(1)));

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, fontFamily: FB, color: C.textSub }}>
          {data.length} registros
        </Text>
        <Text style={{ fontSize: 12, fontFamily: FBB, color: diffColor }}>
          {diff >= 0 ? '+' : ''}{diff.toFixed(1)} kg desde el primer registro
        </Text>
      </View>
      <Svg width={W} height={H}>
        {/* Líneas guía + escala del eje Y */}
        {[0, 0.5, 1].map((t, i) => {
          const y = padT + t * (H - padT - padB);
          return (
            <React.Fragment key={i}>
              <Line
                x1={padL} y1={y}
                x2={W - padR} y2={y}
                stroke={C.border}
                strokeWidth={1}
              />
              <SvgText
                x={padL - 8}
                y={y + 3.5}
                fontSize="11"
                fill={C.textSub}
                textAnchor="end"
              >
                {fmt(max - t * range)}
              </SvgText>
            </React.Fragment>
          );
        })}
        {/* Línea: un solo tono, tramos rectos */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Solo el último punto, que es el dato actual */}
        <Circle cx={toX(data.length - 1)} cy={toY(last.kg)} r={4} fill={color} />
        <SvgText
          x={toX(data.length - 1) + 4}
          y={toY(last.kg) - 10}
          fontSize="11"
          fontWeight="700"
          fill={C.text}
          textAnchor="end"
        >
          {last.kg}kg
        </SvgText>
      </Svg>
      {!!first.date && !!last.date && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: padL, paddingRight: padR }}>
          <Text style={{ fontSize: 11, fontFamily: FB, color: C.textSub }}>{first.date}</Text>
          <Text style={{ fontSize: 11, fontFamily: FB, color: C.textSub }}>{last.date}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Tarjeta de stat (etiqueta arriba, cifra debajo, sin icono) ───────────────
function StatCard({ icon, value, label, color, isDark }: {
  icon: string; value: string; label: string; color: string; isDark: boolean;
}) {
  const C = makePalette(isDark);
  const { num, unit } = splitUnit(value);
  return (
    <View style={sc.card}>
      <Text style={[sc.label, { color: C.textSub }]} numberOfLines={1}>{label}</Text>
      <Text style={[sc.value, { color: C.text }]}>
        {num}
        {unit ? <Text style={[sc.unit, { color: C.textSub }]}>{unit}</Text> : null}
      </Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card:  { flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 4 },
  label: { fontSize: 12, fontFamily: FB },
  value: { fontSize: 30, lineHeight: 32, fontFamily: FC, fontVariant: ['tabular-nums'] },
  unit:  { fontSize: 14, fontFamily: FBB },
});

// ─── Fila de ajuste ───────────────────────────────────────────────────────────
const SETTING_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  '🔔': Bell,
  '🌙': Moon,
  '🔒': Lock,
  '📊': Download,
  '❓': Info,
};

function SettingRow({ icon, label, sub, right, onPress, isDark, last }: {
  icon: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; isDark: boolean; last?: boolean;
}) {
  const C = makePalette(isDark);
  const Wrap: any = onPress ? TouchableOpacity : View;
  const Icon = SETTING_ICONS[icon] ?? Info;
  return (
    <Wrap
      style={[sr.row, { borderBottomColor: C.border, borderBottomWidth: last ? 0 : 1 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon size={18} color={C.textSub} />
      <View style={{ flex: 1 }}>
        <Text style={[sr.label, { color: C.text }]}>{label}</Text>
        {sub ? <Text style={[sr.sub, { color: C.textSub }]}>{sub}</Text> : null}
      </View>
      {right ?? <ChevronRight size={18} color={C.textSub} />}
    </Wrap>
  );
}
const sr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 12 },
  label: { fontSize: 15, fontFamily: FBB },
  sub:   { fontSize: 12, fontFamily: FB, marginTop: 2 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();

  const C = makePalette(isDark);

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
      <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const initials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const negative = isDark ? '#E5566F' : P.red;
  const isAdmin = user?.role === 'admin';

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>

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
                <Text style={{ color: C.textSub, fontFamily: FBB, fontSize: 15 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtnOk, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  setUser((p: any) => ({ ...p, name: editName }));
                  setEditModal(false);
                  Alert.alert('Nombre actualizado');
                }}
              >
                <Text style={{ color: '#fff', fontFamily: FBB, fontSize: 15 }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ════════════════════════════
            TÍTULO + IDENTIDAD
        ════════════════════════════ */}
        <View style={s.titleRow}>
          <Text style={[s.pageTitle, { color: C.text }]}>Perfil</Text>
        </View>

        <View style={s.hero}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={pickPhoto}
            activeOpacity={0.85}
            accessibilityLabel="Cambiar foto de perfil"
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.avatarImg} />
            ) : (
              <View style={[
                s.avatarPlaceholder,
                { backgroundColor: isDark ? Colors.primary + '33' : Colors.primaryLight },
              ]}>
                <Text style={[s.avatarInitials, { color: isDark ? C.text : Colors.primary }]}>{initials}</Text>
              </View>
            )}
            <View style={[s.avatarEditBadge, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Camera size={12} color={C.textSub} />
            </View>
          </TouchableOpacity>

          <View style={s.heroInfo}>
            <TouchableOpacity
              onPress={() => setEditModal(true)}
              style={s.nameRow}
              accessibilityLabel="Editar nombre"
            >
              <Text style={[s.heroName, { color: C.text }]} numberOfLines={1}>{user?.name ?? 'Usuario'}</Text>
              <Pencil size={14} color={C.textSub} />
            </TouchableOpacity>
            <Text style={[s.heroEmail, { color: C.textSub }]} numberOfLines={1}>{user?.email ?? ''}</Text>
            <View style={[
              s.roleBadge,
              { backgroundColor: isAdmin ? '#FEF3C7' : isDark ? '#2A2A2A' : '#E3E6DD' },
            ]}>
              <Text style={[
                s.roleText,
                { color: isAdmin ? '#92400E' : isDark ? '#D6D6D4' : '#4A4944' },
              ]}>
                {isAdmin ? 'Entrenador' : 'Atleta'}
              </Text>
            </View>
          </View>
        </View>

        {/* ════════════════════════════
            RESUMEN
        ════════════════════════════ */}
        <View style={[s.section, { paddingHorizontal: 16, marginTop: 20 }]}>
          <Text style={[s.sectionTitle, { color: C.text }]}>Resumen</Text>
          <View style={[s.statsRow, { backgroundColor: C.surface, borderColor: C.border }]}>
            <StatCard icon="" value={String(totalSessions)} label="Sesiones" color={Colors.primary} isDark={isDark} />
            <View style={[s.statsDivider, { backgroundColor: C.border }]} />
            <StatCard icon="" value={`${(totalKg / 1000).toFixed(1)}t`} label="Volumen total" color={Colors.primary} isDark={isDark} />
            <View style={[s.statsDivider, { backgroundColor: C.border }]} />
            <StatCard icon="" value={`${maxKgEver}kg`} label="Mejor marca" color={Colors.primary} isDark={isDark} />
          </View>
        </View>

        {/* ════════════════════════════
            PROGRESO DE PESOS
        ════════════════════════════ */}
        <View style={[s.section, { paddingHorizontal: 16 }]}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: C.text }]}>Progreso de pesos</Text>
            <Text style={[s.sectionSub, { color: C.textSub }]}>{exerciseList.length} ejercicios</Text>
          </View>

          {exerciseList.length === 0 ? (
            <View style={[s.emptyCard, { borderColor: C.border }]}>
              <Text style={[s.emptyTitle, { color: C.text }]}>Sin registros aún</Text>
              <Text style={[s.emptySub, { color: C.textSub }]}>
                Cuando registres pesos en el calendario aparecerá tu progreso aquí
              </Text>
            </View>
          ) : (
            <View style={[s.progressCard, { backgroundColor: C.surface, borderColor: C.border }]}>

              {/* Selector de ejercicio */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.exSelector}>
                {exerciseList.map((ex) => {
                  const active = (selectedExercise ?? exerciseList[0]?.name) === ex.name;
                  return (
                    <TouchableOpacity
                      key={ex.name}
                      style={[
                        s.exChip,
                        {
                          borderColor: active ? Colors.primary : C.border,
                          backgroundColor: active
                            ? (isDark ? Colors.primary + '33' : Colors.primaryLight)
                            : 'transparent',
                        },
                      ]}
                      onPress={() => setSelectedExercise(ex.name)}
                    >
                      <Text
                        style={[s.exChipText, { color: active ? C.text : C.textSub }]}
                        numberOfLines={1}
                      >
                        {ex.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Cifras + gráfica */}
              {currentExercise && (
                <View style={{ gap: 14 }}>
                  <View style={s.exStatRow}>
                    <View style={s.exStatItem}>
                      <Text style={[s.exStatLbl, { color: C.textSub }]}>Máximo</Text>
                      <Text style={[s.exStatVal, { color: C.text }]}>
                        {currentExercise.maxKg}
                        <Text style={[s.exStatUnit, { color: C.textSub }]}>kg</Text>
                      </Text>
                    </View>
                    <View style={s.exStatItem}>
                      <Text style={[s.exStatLbl, { color: C.textSub }]}>Media</Text>
                      <Text style={[s.exStatVal, { color: C.text }]}>
                        {(currentExercise.data.reduce((s, d) => s + d.kg, 0) / currentExercise.data.length).toFixed(1)}
                        <Text style={[s.exStatUnit, { color: C.textSub }]}>kg</Text>
                      </Text>
                    </View>
                    <View style={s.exStatItem}>
                      <Text style={[s.exStatLbl, { color: C.textSub }]}>Registros</Text>
                      <Text style={[s.exStatVal, { color: C.text }]}>{currentExercise.data.length}</Text>
                    </View>
                  </View>

                  <ProgressChart
                    data={currentExercise.data}
                    color={Colors.primary}
                    isDark={isDark}
                  />
                </View>
              )}

              {/* Tabla de máximos */}
              <View style={[s.maxTable, { borderTopColor: C.border }]}>
                <Text style={[s.maxTableTitle, { color: C.textSub }]}>Mejores marcas</Text>
                {exerciseList.slice(0, 5).map((ex, i, arr) => (
                  <View
                    key={ex.name}
                    style={[
                      s.maxRow,
                      { borderBottomColor: C.border, borderBottomWidth: i === arr.length - 1 ? 0 : 1 },
                    ]}
                  >
                    <Text style={[s.maxName, { color: C.text }]} numberOfLines={1}>{ex.name}</Text>
                    <Text style={[s.maxKg, { color: C.text }]}>
                      {ex.maxKg}
                      <Text style={[s.maxKgUnit, { color: C.textSub }]}> kg</Text>
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
          <Text style={[s.sectionTitle, { color: C.text }]}>Ajustes</Text>
          <View style={[s.settingsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            <SettingRow
              icon="🔔"
              label="Notificaciones"
              sub="Avisos de nuevas rutinas"
              right={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: C.border, true: Colors.primary }}
                  ios_backgroundColor={C.border}
                  thumbColor="#FFFFFF"
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
                  trackColor={{ false: C.border, true: Colors.primary }}
                  ios_backgroundColor={C.border}
                  thumbColor="#FFFFFF"
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
              last
            />
          </View>
        </View>

        {/* ── Cerrar sesión (acción destructiva, al final y aparte) ── */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <TouchableOpacity
            style={[s.logoutBtn, { borderColor: negative }]}
            onPress={handleLogout}
          >
            <LogOut size={18} color={negative} />
            <Text style={[s.logoutText, { color: negative }]}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        {/* ── Versión ── */}
        <Text style={[s.version, { color: C.textSub }]}>Red de Vida v1.0.0</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
// Radios: tarjetas 14, controles 12, chips y pills 99. Sin sombras ni degradados.
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Título + identidad
  titleRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  pageTitle: { fontSize: 30, lineHeight: 32, fontFamily: FC },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 4 },
  avatarWrap: { position: 'relative' },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarInitials: { fontSize: 28, fontFamily: FC },
  avatarEditBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  heroInfo: { flex: 1, gap: 4, alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', minHeight: 32 },
  heroName: { fontSize: 20, fontFamily: FBB, flexShrink: 1 },
  heroEmail: { fontSize: 13, fontFamily: FB, alignSelf: 'stretch' },
  roleBadge: { paddingHorizontal: 10, height: 22, borderRadius: 99, justifyContent: 'center', marginTop: 2 },
  roleText: { fontSize: 12, fontFamily: FBB },

  // Secciones
  section: { gap: 12, marginBottom: 8, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontFamily: FBB },
  sectionSub: { fontSize: 12, fontFamily: FB },

  // KPIs: un solo contenedor dividido por líneas
  statsRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  statsDivider: { width: 1, alignSelf: 'stretch', marginVertical: 14 },

  // Progreso
  progressCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 16 },
  exSelector: { gap: 8, paddingBottom: 2 },
  exChip: {
    height: 34, justifyContent: 'center',
    paddingHorizontal: 14, borderRadius: 99, borderWidth: 1,
  },
  exChipText: { fontSize: 13, fontFamily: FBB, maxWidth: 140 },
  exStatRow: { flexDirection: 'row' },
  exStatItem: { flex: 1, gap: 2 },
  exStatVal: { fontSize: 28, lineHeight: 30, fontFamily: FC, fontVariant: ['tabular-nums'] },
  exStatUnit: { fontSize: 14, fontFamily: FBB },
  exStatLbl: { fontSize: 12, fontFamily: FB },

  // Tabla de máximos
  maxTable: { borderTopWidth: 1, paddingTop: 14 },
  maxTableTitle: { fontSize: 12, fontFamily: FBB, marginBottom: 4 },
  maxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  maxName: { flex: 1, fontSize: 14, fontFamily: FBB },
  maxKg: { fontSize: 16, fontFamily: FBB, fontVariant: ['tabular-nums'], textAlign: 'right' },
  maxKgUnit: { fontSize: 12, fontFamily: FB },

  // Ajustes
  settingsCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, overflow: 'hidden' },

  // Estado vacío: conserva el marco con un borde discontinuo
  emptyCard: {
    borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
    paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 6,
  },
  emptyTitle: { fontSize: 16, fontFamily: FBB },
  emptySub: { fontSize: 13, fontFamily: FB, textAlign: 'center', lineHeight: 18 },

  // Cerrar sesión
  logoutBtn: {
    borderRadius: 12, borderWidth: 1, minHeight: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  logoutText: { fontSize: 15, fontFamily: FBB },

  version: { fontSize: 12, fontFamily: FB, textAlign: 'center', marginTop: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 16 },
  modalTitle: { fontSize: 22, lineHeight: 24, fontFamily: FC },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 48, fontSize: 16, fontFamily: FB },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  modalBtnOk: { flex: 1, borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});