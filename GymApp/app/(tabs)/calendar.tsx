import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator,
  Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { getMyAssignments } from '../../services/api';

const DAY_NAMES_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES_FULL  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTH_NAMES     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const EVENT_COLORS = [
  { bg: '#4F6BED', text: '#fff' },
  { bg: '#7B61FF', text: '#fff' },
  { bg: '#E8401C', text: '#fff' },
  { bg: '#0EA5E9', text: '#fff' },
  { bg: '#22C55E', text: '#fff' },
  { bg: '#F59E0B', text: '#fff' },
];

const toDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (t?: string) => {
  if (!t) return '09:00';
  return t.slice(0, 5);
};

/** Returns grid: weeks of dates for the given month (Monday-first) */
const getMonthGrid = (year: number, month: number): Date[][] => {
  const firstDay = new Date(year, month, 1);
  // Monday=0 offset
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
    // Stop if we've passed the end of month and filled at least 4 weeks
    if (w >= 3 && week[6].getMonth() !== month) break;
  }
  return weeks;
};

const pad = (n: number) => String(n).padStart(2, '0');
const parseTime = (t?: string) => {
  if (!t) return 9 * 60;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9 * 60;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
};
const formatHour = (h: number) =>
  h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;

interface Assignment {
  id: string;
  due_date: string;
  start_time?: string;
  end_time?: string;
  workout?: {
    name: string;
    duration?: number;
    exercises?: { id: number; name: string; muscle_group: string; sets?: number; reps?: number }[];
  };
  client?: { full_name: string };
}

const BLOCK_COLORS = ['#3B6D11', '#6366F1', '#F59E0B', '#EC4899', '#0EA5E9', '#22C55E'];

export default function CalendarScreen() {
  const isDark = useColorScheme() === 'dark';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Assignment | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const C = {
    bg:       isDark ? '#0F172A' : '#FFFFFF',
    surface:  isDark ? '#1E293B' : '#F8FAFC',
    text:     isDark ? '#F1F5F9' : '#111827',
    sub:      isDark ? '#94A3B8' : '#6B7280',
    border:   isDark ? '#1E2D3D' : '#E5E7EB',
    headerBg: isDark ? '#0F172A' : '#FFFFFF',
    red:      '#E8401C',
    primary:  '#4F6BED',
    todayBg:  isDark ? '#1E2D3D' : '#EEF2FF',
    selectedDay: '#4F6BED',
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getMyAssignments();
        const adapted = data.map((a: any) => ({
          id: String(a.id),
          due_date: a.date,
          start_time: '18:06',
          end_time: '19:06',
          workout: {
            name: a.routine?.name || 'Rutina',
            duration: 60,
            exercises: (a.routine?.routine_exercises || []).map((re: any) => re.exercise),
          },
          client: { full_name: 'Yo' },
        }));
        setAssignments(adapted);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  const grid = getMonthGrid(viewYear, viewMonth);

  const eventsOnDay = (d: Date) => assignments.filter(a => a.due_date === toDateString(d));

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
  };

  const dayEventsForModal = assignments.filter(a => a.due_date === toDateString(selectedDate));

  // ── Month Grid ──────────────────────────────────────────────────────────────
  const MonthGrid = () => (
    <View style={{ flex: 1 }}>
      {/* Day headers */}
      <View style={[s.dayHeaderRow, { borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
        {DAY_NAMES_SHORT.map((d, i) => (
          <View key={i} style={s.dayHeaderCell}>
            <Text style={[s.dayHeaderText, { color: C.sub }]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {grid.map((week, wi) => (
          <View key={wi} style={[s.weekRow, { borderBottomColor: C.border }]}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === viewMonth;
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDate);
              const events = eventsOnDay(day);
              const MAX_VISIBLE = 2;

              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    s.dayCell,
                    { borderRightColor: C.border },
                    isToday && !isSelected && { backgroundColor: C.todayBg },
                    isSelected && { backgroundColor: isDark ? '#1a2744' : '#EEF2FF' },
                  ]}
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <View style={s.dayCellHeader}>
                    <View style={[
                      s.dayNumCircle,
                      isSelected && { backgroundColor: C.selectedDay },
                    ]}>
                      <Text style={[
                        s.dayNum,
                        { color: !isCurrentMonth ? C.sub : isSelected ? '#fff' : isToday ? C.selectedDay : C.text },
                        isToday && !isSelected && { fontWeight: '700' },
                      ]}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </View>

                  {/* Event chips */}
                  <View style={s.eventChips}>
                    {events.slice(0, MAX_VISIBLE).map((ev, ei) => {
                      const color = EVENT_COLORS[ei % EVENT_COLORS.length];
                      return (
                        <TouchableOpacity
                          key={ev.id}
                          style={[s.eventChip, { backgroundColor: color.bg }]}
                          onPress={() => { setSelectedDate(day); setSelectedEvent(ev); }}
                          activeOpacity={0.8}
                        >
                          <View style={s.eventChipDot} />
                          <Text style={[s.eventChipText, { color: color.text }]} numberOfLines={1}>
                            {formatTime(ev.start_time)} {ev.workout?.name ?? 'Entreno'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {events.length > MAX_VISIBLE && (
                      <Text style={[s.moreText, { color: C.sub }]}>
                        +{events.length - MAX_VISIBLE} más
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );

  // ── Event Detail Modal ──────────────────────────────────────────────────────
  const EventModal = () => {
    if (!selectedEvent) return null;
    const idx = dayEventsForModal.findIndex(e => e.id === selectedEvent.id);
    const color = EVENT_COLORS[idx >= 0 ? idx % EVENT_COLORS.length : 0];
    const start = parseTime(selectedEvent.start_time);
    const dur = selectedEvent.workout?.duration ?? 60;
    const sh = Math.floor(start / 60);
    const sm = start % 60;
    const eh = Math.floor((start + dur) / 60);
    const em = (start + dur) % 60;
    const exercises = selectedEvent.workout?.exercises ?? [];

    const BLOCK_SIZE = 3;
    const blocks = exercises.length === 0 ? [] :
      Array.from({ length: Math.ceil(exercises.length / BLOCK_SIZE) }, (_, i) =>
        exercises.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
      );

    return (
      <Modal transparent animationType="slide" visible onRequestClose={() => setSelectedEvent(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.eventModal, { backgroundColor: isDark ? '#1E293B' : '#fff', borderTopColor: color.bg }]}>
            <View style={[s.modalStripe, { backgroundColor: color.bg }]} />

            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: C.text }]}>{selectedEvent.workout?.name ?? 'Entrenamiento'}</Text>
                <Text style={[s.modalTime, { color: color.bg }]}>
                  {formatHour(sh)}:{pad(sm)} – {formatHour(eh)}:{pad(em)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEvent(null)} style={s.modalCloseBtn}>
                <Text style={{ color: C.sub, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.modalInfoRow, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: C.border }]}>
              <Text style={s.modalInfoIcon}>📅</Text>
              <View>
                <Text style={[s.modalInfoLabel, { color: C.sub }]}>Fecha</Text>
                <Text style={[s.modalInfoValue, { color: C.text }]}>
                  {DAY_NAMES_FULL[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}, {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
                </Text>
              </View>
            </View>

            <View style={[s.modalDivider, { backgroundColor: C.border }]} />

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {exercises.length === 0 ? (
                <View style={s.noExercises}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>💪</Text>
                  <Text style={[s.noExercisesTxt, { color: C.sub }]}>Sin ejercicios asignados</Text>
                </View>
              ) : blocks.map((blockExs, blockIdx) => (
                <View key={blockIdx} style={s.blockContainer}>
                  <View style={[s.blockHeader, { borderLeftColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length], backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] + '15' }]}>
                    <View style={[s.blockDot, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]} />
                    <Text style={[s.blockTitle, { color: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]}>Bloque {blockIdx + 1}</Text>
                    <Text style={[s.blockCount, { color: C.sub }]}>{blockExs.length} ejercicio{blockExs.length !== 1 ? 's' : ''}</Text>
                  </View>
                  {blockExs.map((ex: any, exIdx: number) => (
                    <View key={ex.id ?? exIdx} style={[s.exRow, { borderBottomColor: C.border, backgroundColor: exIdx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)') }]}>
                      <View style={[s.exNumber, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] + '20' }]}>
                        <Text style={[s.exNumberText, { color: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]}>{exIdx + 1}</Text>
                      </View>
                      <View style={s.exInfo}>
                        <Text style={[s.exName, { color: C.text }]}>{ex.name}</Text>
                        <View style={[s.exBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                          <Text style={[s.exBadgeText, { color: C.sub }]}>{ex.muscle_group}</Text>
                        </View>
                      </View>
                      <View style={s.exStats}>
                        {ex.sets && (
                          <View style={s.exStat}>
                            <Text style={[s.exStatValue, { color: C.text }]}>{ex.sets}</Text>
                            <Text style={[s.exStatLabel, { color: C.sub }]}>series</Text>
                          </View>
                        )}
                        {ex.reps && (
                          <View style={s.exStat}>
                            <Text style={[s.exStatValue, { color: C.text }]}>{ex.reps}</Text>
                            <Text style={[s.exStatLabel, { color: C.sub }]}>reps</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={[s.modalCloseFullBtn, { borderColor: C.border }]} onPress={() => setSelectedEvent(null)}>
              <Text style={[s.modalCloseFullTxt, { color: C.sub }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Day Events Bottom Sheet (tap on a day) ──────────────────────────────────
  const DaySheet = () => {
    const events = eventsOnDay(selectedDate);
    if (events.length === 0 || selectedEvent) return null;
    // Only show if not today (or always, design choice)
    return null; // Using modal pattern via event chip tap instead
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Navbar */}
      <View style={[s.navbar, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={goToday}>
          <Text style={[s.todayBtn, { color: C.red }]}>Hoy</Text>
        </TouchableOpacity>
        <View style={s.navCenter}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <ChevronLeft size={20} color={C.sub} />
          </TouchableOpacity>
          <Text style={[s.navTitle, { color: C.text }]}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <ChevronRight size={20} color={C.sub} />
          </TouchableOpacity>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={[s.loadingText, { color: C.sub }]}>Cargando agenda…</Text>
        </View>
      ) : (
        <MonthGrid />
      )}

      <EventModal />
      <DaySheet />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1 },
  navbar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  todayBtn:       { fontSize: 16, fontWeight: '500', width: 48 },
  navCenter:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle:       { fontSize: 17, fontWeight: '700', minWidth: 160, textAlign: 'center' },
  navBtn:         { padding: 4 },

  // Day header row
  dayHeaderRow:   { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 6 },
  dayHeaderCell:  { flex: 1, alignItems: 'center' },
  dayHeaderText:  { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Week / day grid
  weekRow:        { flexDirection: 'row', borderBottomWidth: 0.5, minHeight: 80 },
  dayCell:        { flex: 1, borderRightWidth: 0.5, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 4 },
  dayCellHeader:  { alignItems: 'center', marginBottom: 2 },
  dayNumCircle:   { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dayNum:         { fontSize: 13, fontWeight: '400' },

  // Event chips
  eventChips:     { gap: 2 },
  eventChip:      { flexDirection: 'row', alignItems: 'center', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, gap: 3, overflow: 'hidden' },
  eventChipDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  eventChipText:  { fontSize: 10, fontWeight: '500', flex: 1 },
  moreText:       { fontSize: 10, paddingHorizontal: 4, marginTop: 1 },

  loadingBox:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText:    { fontSize: 14 },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  eventModal:     { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 4, padding: 20, paddingBottom: 36, maxHeight: '85%' },
  modalStripe:    { display: 'none' },
  modalHeader:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle:     { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  modalTime:      { fontSize: 14, fontWeight: '600' },
  modalCloseBtn:  { padding: 4 },

  modalInfoRow:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 0.5, padding: 14, marginBottom: 16, gap: 12 },
  modalInfoIcon:  { fontSize: 20 },
  modalInfoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  modalInfoValue: { fontSize: 14, fontWeight: '600' },

  modalDivider:   { height: 0.5, marginBottom: 16 },

  noExercises:    { alignItems: 'center', paddingVertical: 32 },
  noExercisesTxt: { fontSize: 14 },

  blockContainer: { marginBottom: 12 },
  blockHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderLeftWidth: 3, borderRadius: 4, marginBottom: 4 },
  blockDot:       { width: 8, height: 8, borderRadius: 4 },
  blockTitle:     { fontSize: 13, fontWeight: '700', flex: 1 },
  blockCount:     { fontSize: 11 },

  exRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  exNumber:       { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  exNumberText:   { fontSize: 12, fontWeight: '700' },
  exInfo:         { flex: 1, gap: 4 },
  exName:         { fontSize: 14, fontWeight: '600' },
  exBadge:        { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  exBadgeText:    { fontSize: 10, fontWeight: '500' },
  exStats:        { flexDirection: 'row', gap: 10 },
  exStat:         { alignItems: 'center' },
  exStatValue:    { fontSize: 15, fontWeight: '700' },
  exStatLabel:    { fontSize: 10 },

  modalCloseFullBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 0.5, alignItems: 'center' },
  modalCloseFullTxt: { fontSize: 14 },
});