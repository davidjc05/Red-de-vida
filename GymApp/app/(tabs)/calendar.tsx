import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react-native';
import { getMyAssignments, confirmWorkout, saveWorkoutLog } from '../../services/api';
import { Colors } from '../../constants/colors';

// ─── Paleta (del segundo) ─────────────────────────────────────────────────────
const G = {
  primary:  '#3B6D11',
  mid:      '#5A9E1A',
  light:    '#EAF3DE',
  lighter:  '#F4FAF0',
  accent:   '#97C459',
  dark:     '#2A5009',
  white:    '#FFFFFF',
  text:     '#1A2E0A',
  textSub:  '#6B8C4A',
  border:   '#D4E8BB',
  red:      '#EF4444',
  redLight: '#FEF2F2',
};

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAY_NAMES_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES_FULL  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTH_NAMES     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const BLOCK_COLORS    = [G.primary, '#6366F1', '#F59E0B', '#EC4899', '#0EA5E9', '#22C55E'];

// ─── Helpers de fecha/tiempo (del primero) ────────────────────────────────────
const toDateString = (d: Date) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const pad = (n: number) => String(n).padStart(2, '0');

const formatTime = (t?: string) => (t ? t.slice(0, 5) : '09:00');

const parseTime = (t?: string) => {
  if (!t) return 9 * 60;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9 * 60;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
};

const formatHour = (h: number) =>
  h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

const getMonthGrid = (year: number, month: number): Date[][] => {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const start = new Date(firstDay);
  start.setDate(start.getDate() - startOffset);
  const weeks: Date[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (w >= 3 && week[6].getMonth() !== month) break;
  }
  return weeks;
};

// ─── Tipos (del primero, completos) ──────────────────────────────────────────
interface Assignment {
  id: string;
  due_date: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  workout?: {
    name: string;
    duration?: number;
    exercises?: {
      id: number; name: string; muscle_group: string;
      sets?: number; reps?: number;
      description?: string; image_url?: string; video_url?: string;
    }[];
  };
  client?: { full_name: string };
}

// ─── DayView (diseño del segundo) ────────────────────────────────────────────
function DayView({
  date,
  events,
  onBack,
  onSelectEvent,
}: {
  date: Date;
  events: Assignment[];
  onBack: () => void;
  onSelectEvent: (ev: Assignment) => void;
}) {
  const dayName = DAY_NAMES_FULL[date.getDay() === 0 ? 6 : date.getDay() - 1];
  const hasEvents = events.length > 0;

  return (
    <View style={{ flex: 1 }}>
      {/* Header día */}
      <View style={dv.header}>
        <TouchableOpacity onPress={onBack} style={dv.backBtn}>
          <ChevronLeft size={20} color={G.primary} />
        </TouchableOpacity>
        <Text style={dv.title}>
          {dayName}, {date.getDate()} de {MONTH_NAMES[date.getMonth()]}
        </Text>
        <View style={[dv.calIcon, { backgroundColor: G.light }]}>
          <Calendar size={18} color={G.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {/* Banner motivacional */}
        {hasEvents ? (
          <View style={[dv.banner, { backgroundColor: G.lighter, borderColor: G.border }]}>
            <View style={[dv.bannerIcon, { backgroundColor: G.light }]}>
              <Text style={{ fontSize: 22 }}>👟</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dv.bannerTitle}>¡Día de entreno!</Text>
              <Text style={dv.bannerSub}>
                Tienes {events.length} rutina{events.length !== 1 ? 's' : ''} programada{events.length !== 1 ? 's' : ''} para hoy.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[dv.banner, { backgroundColor: G.lighter, borderColor: G.border }]}>
            <View style={[dv.bannerIcon, { backgroundColor: G.light }]}>
              <Text style={{ fontSize: 22 }}>💚</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dv.bannerTitle}>Cada paso cuenta.</Text>
              <Text style={dv.bannerSub}>¡Tú puedes!</Text>
            </View>
          </View>
        )}

        {/* Lista de rutinas del día */}
        {hasEvents && (
          <>
            <Text style={dv.sectionTitle}>Rutinas del día</Text>
            {events.map(ev => {
              const start = parseTime(ev.start_time);
              const dur   = ev.workout?.duration ?? 60;
              const sh = Math.floor(start / 60), sm = start % 60;
              const eh = Math.floor((start + dur) / 60), em = (start + dur) % 60;

              return (
                <TouchableOpacity
                  key={ev.id}
                  style={[dv.eventRow, { borderColor: G.border }]}
                  onPress={() => onSelectEvent(ev)}
                  activeOpacity={0.85}
                >
                  <View style={[dv.eventIcon, { backgroundColor: G.light }]}>
                    <Text style={{ fontSize: 18 }}>🏋️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={dv.eventName}>{ev.workout?.name ?? 'Rutina'}</Text>
                    {/* Hora real del primero */}
                    <Text style={dv.eventSub}>
                      {formatHour(sh)}:{pad(sm)} – {formatHour(eh)}:{pad(em)} · {dur} min
                    </Text>
                  </View>
                  <View style={[
                    dv.statusPill,
                    ev.status === 'confirmed' && { backgroundColor: G.light },
                    ev.status === 'declined'  && { backgroundColor: '#FEE2E2' },
                    ev.status === 'pending'   && { backgroundColor: '#FEF3C7' },
                  ]}>
                    <Text style={[
                      dv.statusText,
                      ev.status === 'confirmed' && { color: G.primary },
                      ev.status === 'declined'  && { color: '#991B1B' },
                      ev.status === 'pending'   && { color: '#92400E' },
                    ]}>
                      {ev.status === 'confirmed' ? 'Confirmada' :
                       ev.status === 'declined'  ? 'Rechazada'  : 'Pendiente'}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={G.textSub} />
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* Sin rutinas */}
        {!hasEvents && (
          <View style={dv.emptyBox}>
            <Text style={{ fontSize: 40 }}>🌿</Text>
            <Text style={dv.emptyTitle}>Sin rutinas hoy</Text>
            <Text style={dv.emptySub}>Descansa o disfruta el día libre</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const dv = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: G.white, borderBottomWidth: 1, borderBottomColor: G.border,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: G.lighter, alignItems: 'center', justifyContent: 'center',
  },
  title:   { flex: 1, fontSize: 16, fontWeight: '700', color: G.text },
  calIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 15, fontWeight: '700', color: G.text },
  bannerSub:   { fontSize: 12, color: G.textSub, marginTop: 2 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: G.text },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: G.white, borderRadius: 16, borderWidth: 1, padding: 14,
  },
  eventIcon:  { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventName:  { fontSize: 15, fontWeight: '700', color: G.text },
  eventSub:   { fontSize: 12, color: G.textSub, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  emptyBox:   { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: G.text },
  emptySub:   { fontSize: 13, color: G.textSub },
});

// ─── RoutineModal — diseño del segundo + lógica completa del primero ──────────
function RoutineModal({
  event,
  date,
  onClose,
  onConfirm,
  onDecline,
  onCancel,
  logs,
  setLogs,
  onSaveLog,
}: {
  event: Assignment | null;
  date: Date;
  onClose: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  onCancel: () => void;
  logs: Record<string, { kg?: string; reps?: string }>;
  setLogs: React.Dispatch<React.SetStateAction<Record<string, { kg?: string; reps?: string }>>>;
  onSaveLog: (workoutId: string, exId: number, logData: { kg?: string; reps?: string }) => void;
}) {
  if (!event) return null;

  // Hora real (del primero)
  const start = parseTime(event.start_time);
  const dur   = event.workout?.duration ?? 60;
  const sh = Math.floor(start / 60), sm = start % 60;
  const eh = Math.floor((start + dur) / 60), em = (start + dur) % 60;

  const exercises = event.workout?.exercises ?? [];
  const BLOCK_SIZE = 3;
  const blocks = exercises.length === 0 ? [] :
    Array.from({ length: Math.ceil(exercises.length / BLOCK_SIZE) }, (_, i) =>
      exercises.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
    );

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <View style={rm.handle} />

          {/* Header verde */}
          <View style={rm.hero}>
            <View style={rm.heroIcon}>
              <Text style={{ fontSize: 22 }}>🏋️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rm.heroTitle}>{event.workout?.name ?? 'Entrenamiento'}</Text>
              {/* Hora calculada del primero */}
              <Text style={rm.heroSub}>
                {formatHour(sh)}:{pad(sm)} – {formatHour(eh)}:{pad(em)}
              </Text>
            </View>
            {event.status === 'confirmed' && (
              <View style={rm.confirmedBadge}>
                <Text style={rm.confirmedText}>Confirmada</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClose} style={rm.closeBtn}>
              <X size={18} color={G.accent} />
            </TouchableOpacity>
          </View>

          {/* Fila de fecha + badge estado (del primero) */}
          <View style={rm.dateRow}>
            <View style={[rm.dateIcon, { backgroundColor: G.light }]}>
              <Calendar size={16} color={G.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={rm.dateLabel}>FECHA</Text>
              <Text style={rm.dateValue}>
                {DAY_NAMES_FULL[date.getDay() === 0 ? 6 : date.getDay() - 1]},{' '}
                {date.getDate()} de {MONTH_NAMES[date.getMonth()]}
              </Text>
            </View>
            <View style={[
              rm.statusPill,
              event.status === 'confirmed' && { backgroundColor: G.light },
              event.status === 'declined'  && { backgroundColor: '#FEE2E2' },
              event.status === 'pending'   && { backgroundColor: '#FEF3C7' },
            ]}>
              <Text style={[
                rm.statusText,
                event.status === 'confirmed' && { color: G.primary },
                event.status === 'declined'  && { color: '#991B1B' },
                event.status === 'pending'   && { color: '#92400E' },
              ]}>
                {event.status === 'confirmed' ? '✓ Confirmado' :
                 event.status === 'declined'  ? '✗ Rechazado'  : '⏳ Pendiente'}
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Bloques de ejercicios (del primero: chunks de 3) */}
            {exercises.length === 0 ? (
              <View style={rm.noEx}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>💪</Text>
                <Text style={{ color: G.textSub, fontSize: 14 }}>Sin ejercicios asignados</Text>
              </View>
            ) : (
              blocks.map((blockExs, blockIdx) => (
                <View key={blockIdx} style={rm.block}>
                  <View style={rm.blockHeader}>
                    <View style={[rm.blockDot, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]} />
                    <Text style={[rm.blockTitle, { color: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]}>
                      Bloque {blockIdx + 1}
                    </Text>
                    <Text style={rm.blockCount}>· {blockExs.length} ejercicio{blockExs.length !== 1 ? 's' : ''}</Text>
                  </View>

                  {blockExs.map((ex, exIdx) => (
                    <View
                      key={ex.id ?? exIdx}
                      style={[
                        rm.exRow,
                        { backgroundColor: exIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)' },
                      ]}
                    >
                      <View style={[rm.exNum, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] + '20' }]}>
                        <Text style={[rm.exNumText, { color: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]}>
                          {exIdx + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={rm.exName}>{ex.name}</Text>
                        <View style={[rm.exBadge, { backgroundColor: G.light }]}>
                          <Text style={[rm.exBadgeText, { color: G.primary }]}>{ex.muscle_group}</Text>
                        </View>
                      </View>
                      <View style={rm.exStats}>
                        {ex.sets && (
                          <View style={rm.exStat}>
                            <Text style={rm.exStatVal}>{ex.sets}</Text>
                            <Text style={rm.exStatLbl}>series</Text>
                          </View>
                        )}
                        {ex.reps && (
                          <View style={rm.exStat}>
                            <Text style={rm.exStatVal}>{ex.reps}</Text>
                            <Text style={rm.exStatLbl}>reps</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}

            {/* Log de pesos si está confirmado (del primero, diseño del segundo) */}
            {event.status === 'confirmed' && exercises.map((ex, exIndex) => (
              <View key={`log_${exIndex}`} style={rm.logCard}>
                <Text style={rm.logName}>{ex.name}</Text>
                <View style={rm.logRow}>
                  <View style={rm.logField}>
                    <Text style={rm.logLabel}>KG</Text>
                    <TextInput
                      style={rm.logInput}
                      placeholder="0"
                      placeholderTextColor={G.textSub}
                      keyboardType="numeric"
                      value={logs[`${event.id}_${ex.id}`]?.kg ?? ''}
                      onChangeText={t =>
                        setLogs(p => ({
                          ...p,
                          [`${event.id}_${ex.id}`]: { ...p[`${event.id}_${ex.id}`], kg: t },
                        }))
                      }
                    />
                  </View>
                  <View style={rm.logField}>
                    <Text style={rm.logLabel}>REPS</Text>
                    <TextInput
                      style={rm.logInput}
                      placeholder="0"
                      placeholderTextColor={G.textSub}
                      keyboardType="numeric"
                      value={logs[`${event.id}_${ex.id}`]?.reps ?? ''}
                      onChangeText={t =>
                        setLogs(p => ({
                          ...p,
                          [`${event.id}_${ex.id}`]: { ...p[`${event.id}_${ex.id}`], reps: t },
                        }))
                      }
                    />
                  </View>
                  <TouchableOpacity
                    style={rm.logSaveBtn}
                    onPress={() => onSaveLog(event.id, ex.id, logs[`${event.id}_${ex.id}`] ?? {})}
                  >
                    <Text style={{ color: G.white, fontWeight: '800', fontSize: 16 }}>✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Botones de acción (lógica completa del primero) */}
            <View style={{ paddingHorizontal: 4, gap: 10, marginTop: 16 }}>
              {event.status === 'pending' && (
                <>
                  <TouchableOpacity style={rm.btnConfirm} onPress={onConfirm}>
                    <Text style={rm.btnConfirmText}>✓ Confirmar entreno</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={rm.btnDecline} onPress={onDecline}>
                    <Text style={rm.btnDeclineText}>✕ No puedo entrenar</Text>
                  </TouchableOpacity>
                </>
              )}
              {event.status === 'confirmed' && (
                <>
                  <View style={rm.statusBanner}>
                    <Text style={rm.statusBannerText}>✅ Entrenamiento confirmado</Text>
                  </View>
                  <TouchableOpacity style={rm.btnDecline} onPress={onCancel}>
                    <Text style={rm.btnDeclineText}>✕ Cancelar entreno</Text>
                  </TouchableOpacity>
                </>
              )}
              {event.status === 'declined' && (
                <View style={[rm.statusBanner, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[rm.statusBannerText, { color: '#991B1B' }]}>❌ Entrenamiento rechazado</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={rm.closeFullBtn} onPress={onClose}>
              <Text style={rm.closeFullText}>Cerrar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    flex: 1, marginTop: 60,
    backgroundColor: G.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 0,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: G.border, alignSelf: 'center', marginBottom: 16 },
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: G.primary, borderRadius: 16, padding: 14, marginBottom: 14,
  },
  heroIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: G.dark, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '700', color: G.light },
  heroSub: { fontSize: 12, color: G.accent, marginTop: 2 },
  confirmedBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confirmedText: { fontSize: 11, fontWeight: '700', color: G.white },
  closeBtn: { padding: 4 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: G.lighter, borderRadius: 12, padding: 12, marginBottom: 14,
  },
  dateIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dateLabel: { fontSize: 10, fontWeight: '700', color: G.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateValue: { fontSize: 13, fontWeight: '600', color: G.text, marginTop: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  noEx: { alignItems: 'center', paddingVertical: 32 },
  block: { marginBottom: 12 },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 4 },
  blockDot: { width: 8, height: 8, borderRadius: 4 },
  blockTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  blockCount: { fontSize: 12, color: G.textSub },
  exRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: G.border,
  },
  exNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  exNumText: { fontSize: 12, fontWeight: '700' },
  exName: { fontSize: 13, fontWeight: '600', color: G.text },
  exBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  exBadgeText: { fontSize: 10, fontWeight: '600' },
  exStats: { flexDirection: 'row', gap: 10 },
  exStat: { alignItems: 'center', minWidth: 36 },
  exStatVal: { fontSize: 15, fontWeight: '700', color: G.text },
  exStatLbl: { fontSize: 9, color: G.textSub },
  logCard: { backgroundColor: G.lighter, borderRadius: 12, borderWidth: 1, borderColor: G.border, padding: 12, marginBottom: 8 },
  logName: { fontSize: 13, fontWeight: '700', color: G.text, marginBottom: 8 },
  logRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  logField: { flex: 1 },
  logLabel: { fontSize: 10, fontWeight: '700', color: G.primary, letterSpacing: 0.5, marginBottom: 4 },
  logInput: {
    borderWidth: 1, borderColor: G.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 18, fontWeight: '800', textAlign: 'center',
    color: G.text, backgroundColor: G.white,
  },
  logSaveBtn: {
    backgroundColor: G.primary, width: 48, height: 48,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
  },
  btnConfirm: { backgroundColor: G.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnConfirmText: { color: G.white, fontWeight: '700', fontSize: 15 },
  btnDecline: {
    borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  btnDeclineText: { color: '#991B1B', fontWeight: '700', fontSize: 14 },
  statusBanner: { backgroundColor: G.light, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statusBannerText: { color: G.primary, fontWeight: '700', fontSize: 15 },
  closeFullBtn: {
    marginTop: 14, paddingVertical: 14, borderRadius: 12,
    borderWidth: 0.5, borderColor: G.border, alignItems: 'center', marginBottom: 20,
  },
  closeFullText: { fontSize: 14, color: G.textSub },
});

// ─── ActiveWorkoutPanel (del primero, diseño del segundo) ─────────────────────
function ActiveWorkoutPanel({
  activeWorkout,
  logs,
  setLogs,
  onSaveLog,
  onCancelWorkout,
}: {
  activeWorkout: Assignment[];
  logs: Record<string, { kg?: string; reps?: string }>;
  setLogs: React.Dispatch<React.SetStateAction<Record<string, { kg?: string; reps?: string }>>>;
  onSaveLog: (workoutId: string, exId: number, logData: { kg?: string; reps?: string }) => void;
  onCancelWorkout: (workoutId: string) => void;
}) {
  if (activeWorkout.length === 0) return null;

  return (
    <View style={{ gap: 16 }}>
      {activeWorkout.map(workout => {
        const exercises = workout.workout?.exercises ?? [];
        const workoutDate = new Date(workout.due_date);
        const dayName = DAY_NAMES_FULL[workoutDate.getDay() === 0 ? 6 : workoutDate.getDay() - 1];

        return (
          <View key={workout.id} style={aw.card}>
            {/* Header */}
            <View style={aw.header}>
              <View style={aw.heroLeft}>
                <View style={aw.iconBox}>
                  <Text style={{ fontSize: 20 }}>🔥</Text>
                </View>
                <View>
                  <Text style={aw.eyebrow}>ENTRENO ACTIVO</Text>
                  <Text style={aw.title}>{workout.workout?.name ?? 'Entrenamiento'}</Text>
                  <Text style={aw.date}>
                    {dayName} · {workoutDate.getDate()} de {MONTH_NAMES[workoutDate.getMonth()]}
                  </Text>
                </View>
              </View>
              <View style={aw.badge}>
                <Text style={aw.badgeText}>Confirmado</Text>
              </View>
            </View>

            {/* Cards de log por ejercicio */}
            {exercises.map((ex, exIndex) => (
              <View key={`${workout.id}_${ex.id}_${exIndex}`} style={aw.logCard}>
                <Text style={aw.logName}>{ex.name}</Text>
                <View style={aw.logRow}>
                  <View style={aw.logField}>
                    <Text style={aw.logLabel}>KG</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={G.textSub}
                      keyboardType="numeric"
                      value={logs[`${workout.id}_${ex.id}`]?.kg ?? ''}
                      onChangeText={t =>
                        setLogs(p => ({
                          ...p,
                          [`${workout.id}_${ex.id}`]: { ...p[`${workout.id}_${ex.id}`], kg: t },
                        }))
                      }
                      style={aw.logInput}
                    />
                  </View>
                  <View style={aw.logField}>
                    <Text style={aw.logLabel}>REPS</Text>
                    <TextInput
                      placeholder="0"
                      placeholderTextColor={G.textSub}
                      keyboardType="numeric"
                      value={logs[`${workout.id}_${ex.id}`]?.reps ?? ''}
                      onChangeText={t =>
                        setLogs(p => ({
                          ...p,
                          [`${workout.id}_${ex.id}`]: { ...p[`${workout.id}_${ex.id}`], reps: t },
                        }))
                      }
                      style={aw.logInput}
                    />
                  </View>
                  <TouchableOpacity
                    style={aw.saveBtn}
                    onPress={() => onSaveLog(workout.id, ex.id, logs[`${workout.id}_${ex.id}`] ?? {})}
                  >
                    <Text style={{ color: G.white, fontWeight: '800', fontSize: 16 }}>✓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <TouchableOpacity style={aw.cancelBtn} onPress={() => onCancelWorkout(workout.id)}>
              <Text style={aw.cancelText}>Cancelar entreno</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const aw = StyleSheet.create({
  card: {
    backgroundColor: G.white, borderRadius: 22, padding: 14,
    borderWidth: 1, borderColor: G.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: G.light, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', color: G.primary, letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: '700', color: G.text, marginTop: 1 },
  date: { fontSize: 12, color: G.mid, fontWeight: '600', marginTop: 2 },
  badge: { backgroundColor: G.light, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  badgeText: { color: G.primary, fontSize: 11, fontWeight: '700' },
  logCard: { backgroundColor: G.lighter, borderRadius: 12, borderWidth: 1, borderColor: G.border, padding: 10, marginBottom: 8 },
  logName: { fontSize: 14, fontWeight: '700', color: G.text, marginBottom: 8 },
  logRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  logField: { flex: 1 },
  logLabel: { fontSize: 10, fontWeight: '700', color: G.primary, letterSpacing: 0.5, marginBottom: 4 },
  logInput: {
    borderWidth: 1, borderColor: G.border, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 10,
    fontSize: 18, fontWeight: '800', textAlign: 'center',
    color: G.text, backgroundColor: G.white, minHeight: 50,
  },
  saveBtn: {
    backgroundColor: G.primary, width: 50, height: 50,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
  },
  cancelBtn: {
    marginTop: 10, borderWidth: 1, borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2', paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  cancelText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function CalendarScreen() {
  const [assignments, setAssignments]   = useState<Assignment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [today]                         = useState(new Date());
  const [viewYear, setViewYear]         = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth]       = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Assignment | null>(null);

  // Estado de entreno activo: igual que el primero
  const [activeWorkout, setActiveWorkout] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<Record<string, { kg?: string; reps?: string }>>({});

  // ─── Carga de datos (del primero, completa) ───────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getMyAssignments();
        if (!data || !Array.isArray(data)) { setAssignments([]); return; }
        const adapted: Assignment[] = data.map((a: any) => ({
          id: String(a.id),
          status: a.status || 'pending',
          due_date: a.date?.split('T')[0],
          start_time: '18:06',   // mismo valor que el primero
          end_time: '19:06',
          workout: {
            name: a.routine?.name || 'Rutina',
            duration: 60,
            exercises: (a.routine?.blocks?.flatMap((block: any) =>
              block.exercises.map((be: any) => ({
                id: be.exercise?.id,
                name: be.exercise?.name,
                muscle_group: be.exercise?.muscle_group,
                description: be.exercise?.description,
                image_url: be.exercise?.image_url,
                video_url: be.exercise?.video_url,
                sets: be.sets,
                reps: be.reps,
              }))
            ) || []),
          },
          client: { full_name: 'Yo' },
        }));
        setAssignments(adapted);
        // Sincroniza activeWorkout con los ya confirmados (del primero)
        setActiveWorkout(adapted.filter(a => a.status === 'confirmed'));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ─── Helpers de navegación ────────────────────────────────────────────────
  const grid       = getMonthGrid(viewYear, viewMonth);
  const eventsOnDay = (d: Date) => assignments.filter(a => a.due_date === toDateString(d));
  const prevMonth  = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth  = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  // goToday del primero: resetea a hoy pero preserva selectedDate a null
  const goToday    = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(null); };

  // ─── Stats del mes (del primero) ──────────────────────────────────────────
  const monthEvents    = assignments.filter(a => {
    const d = new Date(a.due_date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const confirmedCount = monthEvents.filter(a => a.status === 'confirmed').length;
  const pendingCount   = monthEvents.filter(a => a.status === 'pending').length;

  // ─── Handlers de confirmación (del primero, completos) ───────────────────
  const handleConfirm = async () => {
    if (!selectedEvent) return;
    try {
      await confirmWorkout(Number(selectedEvent.id), 'confirmed');
      const updated = { ...selectedEvent, status: 'confirmed' };
      setAssignments(prev => prev.map(a => a.id === selectedEvent.id ? updated : a));
      setActiveWorkout(prev => [...prev, updated]);  // agrega al panel activo
      setSelectedEvent(updated);
    } catch (e) { console.log(e); }
  };

  const handleDecline = async () => {
    if (!selectedEvent) return;
    try {
      await confirmWorkout(Number(selectedEvent.id), 'declined');
      const updated = { ...selectedEvent, status: 'declined' };
      setAssignments(prev => prev.map(a => a.id === selectedEvent.id ? updated : a));
      setSelectedEvent(updated);
    } catch (e) { console.log(e); }
  };

  // Cancela desde el modal de detalle (del primero)
  const handleCancel = async () => {
    if (!selectedEvent) return;
    try {
      await confirmWorkout(Number(selectedEvent.id), 'declined');
      setAssignments(prev => prev.map(a => a.id === selectedEvent.id ? { ...a, status: 'declined' } : a));
      setActiveWorkout(prev => prev.filter(w => w.id !== selectedEvent.id));
      setSelectedEvent(null);
    } catch (e) { console.log(e); }
  };

  // Cancela desde el panel de entreno activo (del primero)
  const handleCancelWorkout = async (workoutId: string) => {
    try {
      await confirmWorkout(Number(workoutId), 'declined');
      setAssignments(prev => prev.map(a => a.id === workoutId ? { ...a, status: 'declined' } : a));
      setActiveWorkout(prev => prev.filter(w => w.id !== workoutId));
    } catch (e) { console.log(e); }
  };

  const handleSaveLog = async (
    workoutId: string,
    exId: number,
    logData: { kg?: string; reps?: string },
  ) => {
    try {
      await saveWorkoutLog({
        assignment_id: Number(workoutId),
        exercise_id:   exId,
        kg:            Number(logData?.kg   || 0),
        reps:          Number(logData?.reps || 0),
      });
    } catch (e) { console.log(e); }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={require('../../assets/images/fondoInicio.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      {/* Overlay suave (del segundo) */}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(244,250,240,0.88)' }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>

        {selectedDate ? (
          /* ── Vista del día (del segundo) ── */
          <DayView
            date={selectedDate}
            events={eventsOnDay(selectedDate)}
            onBack={() => setSelectedDate(null)}
            onSelectEvent={setSelectedEvent}
          />
        ) : (
          /* ── Vista calendario ── */
          <>
            {/* Header navegación (diseño del segundo) */}
            <View style={s.header}>
              <TouchableOpacity onPress={goToday} style={s.todayBtn}>
                <Text style={s.todayText}>Hoy</Text>
              </TouchableOpacity>
              <View style={s.navRow}>
                <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
                  <ChevronLeft size={20} color={G.primary} />
                </TouchableOpacity>
                <Text style={s.navTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
                <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
                  <ChevronRight size={20} color={G.primary} />
                </TouchableOpacity>
              </View>
              <View style={[s.calIconBtn, { backgroundColor: G.light }]}>
                <Calendar size={18} color={G.primary} />
              </View>
            </View>

            {/* Stats mensuales (diseño del segundo, datos del primero) */}
            <View style={s.statsRow}>
              {[
                { val: monthEvents.length, lbl: 'sesiones' },
                { val: confirmedCount,     lbl: 'confirmadas' },
                { val: pendingCount,       lbl: 'pendientes' },
              ].map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={s.statsDivider} />}
                  <View style={s.statItem}>
                    <Text style={s.statVal}>{item.val}</Text>
                    <Text style={s.statLbl}>{item.lbl}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {loading ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={G.primary} size="large" />
                <Text style={{ color: G.textSub, marginTop: 10 }}>Cargando agenda…</Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Grid del mes (diseño del segundo) */}
                <View style={s.gridCard}>
                  {/* Cabecera de días */}
                  <View style={s.dayHeaderRow}>
                    {DAY_NAMES_SHORT.map((d, i) => (
                      <View key={i} style={s.dayHeaderCell}>
                        <Text style={s.dayHeaderText}>{d}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Semanas */}
                  {grid.map((week, wi) => (
                    <View key={wi} style={[s.weekRow, { borderBottomColor: G.border }]}>
                      {week.map((day, di) => {
                        const isCurrentMonth = day.getMonth() === viewMonth;
                        const isToday    = isSameDay(day, today);
                        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                        const events     = eventsOnDay(day);
                        return (
                          <TouchableOpacity
                            key={di}
                            style={[
                              s.dayCell,
                              { borderRightColor: G.border },
                              isToday && !isSelected && { backgroundColor: G.lighter },
                              isSelected && { backgroundColor: G.light },
                            ]}
                            onPress={() => setSelectedDate(day)}
                            activeOpacity={0.7}
                          >
                            <View style={s.dayCellHeader}>
                              <View style={[
                                s.dayNumCircle,
                                isSelected && { backgroundColor: G.primary },
                                isToday && !isSelected && { backgroundColor: G.primary + '33' },
                              ]}>
                                <Text style={[
                                  s.dayNum,
                                  {
                                    color: !isCurrentMonth ? G.border
                                      : isSelected  ? G.white
                                      : isToday     ? G.primary
                                      : G.text,
                                  },
                                  (isToday || isSelected) && { fontWeight: '700' },
                                ]}>
                                  {day.getDate()}
                                </Text>
                              </View>
                            </View>

                            {/* Chips de evento: hasta 2 como el primero, texto con hora real */}
                            <View style={s.eventChips}>
                              {events.slice(0, 2).map(ev => (
                                <TouchableOpacity
                                  key={ev.id}
                                  style={[
                                    s.eventChip,
                                    { backgroundColor: ev.status === 'confirmed' ? G.primary : G.mid },
                                  ]}
                                  onPress={() => { setSelectedDate(day); setSelectedEvent(ev); }}
                                  activeOpacity={0.8}
                                >
                                  <View style={s.eventChipDot} />
                                  <Text style={s.eventChipText} numberOfLines={1}>
                                    {formatTime(ev.start_time)} {ev.workout?.name ?? 'Rutina'}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                              {events.length > 2 && (
                                <Text style={[s.moreText, { color: G.textSub }]}>
                                  +{events.length - 2} más
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>

                {/* Panel de entreno activo integrado (del primero) */}
                {activeWorkout.length > 0 && (
                  <View style={s.activeSection}>
                    <ActiveWorkoutPanel
                      activeWorkout={activeWorkout}
                      logs={logs}
                      setLogs={setLogs}
                      onSaveLog={handleSaveLog}
                      onCancelWorkout={handleCancelWorkout}
                    />
                  </View>
                )}
              </ScrollView>
            )}
          </>
        )}

        {/* Modal detalle rutina */}
        <RoutineModal
          event={selectedEvent}
          date={selectedDate ?? today}
          onClose={() => setSelectedEvent(null)}
          onConfirm={handleConfirm}
          onDecline={handleDecline}
          onCancel={handleCancel}
          logs={logs}
          setLogs={setLogs}
          onSaveLog={handleSaveLog}
        />

      </SafeAreaView>
    </ImageBackground>
  );
}

// ─── Estilos pantalla principal ───────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: G.light, borderRadius: 20 },
  todayText: { fontSize: 13, fontWeight: '700', color: G.primary },
  navRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: G.light, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '800', color: G.text, minWidth: 130, textAlign: 'center' },
  calIconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 12, marginBottom: 10,
    backgroundColor: G.white, borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 8,
    borderWidth: 1, borderColor: G.border,
  },
  statsDivider: { width: 1, backgroundColor: G.border, marginVertical: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: '800', color: G.primary },
  statLbl: { fontSize: 10, color: G.textSub, fontWeight: '500' },

  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Card del grid
  gridCard: {
    backgroundColor: G.white, marginHorizontal: 12,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: G.border,
    marginBottom: 12,
  },
  dayHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: G.border, paddingVertical: 8,
    backgroundColor: G.lighter,
  },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, fontWeight: '700', color: G.textSub, textTransform: 'uppercase' },
  weekRow: { flexDirection: 'row', borderBottomWidth: 0.5, minHeight: 72 },
  dayCell: { flex: 1, borderRightWidth: 0.5, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 4 },
  dayCellHeader: { alignItems: 'center', marginBottom: 2 },
  dayNumCircle: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dayNum: { fontSize: 13, fontWeight: '400' },

  // Chips (altura del primero: hasta 2 + dot)
  eventChips: { gap: 2 },
  eventChip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
    gap: 3, overflow: 'hidden',
  },
  eventChipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  eventChipText: { fontSize: 9, fontWeight: '600', color: G.white, flex: 1 },
  moreText: { fontSize: 9, paddingHorizontal: 4, marginTop: 1 },

  // Sección de entreno activo
  activeSection: {
    paddingHorizontal: 14, paddingTop: 22, paddingBottom: 32,
    backgroundColor: G.lighter,
    borderTopWidth: 1, borderTopColor: G.border,
  },
});