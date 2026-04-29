import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Dimensions,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  AlignJustify,
  Search,
  Inbox,
} from 'lucide-react-native';

import { getMyAssignments } from '../../services/api';
// ─── Constantes ───────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');
const HOUR_HEIGHT   = 64;   // px por hora en la timeline
const HOURS         = Array.from({ length: 24 }, (_, i) => i); // 0..23
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES     = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Paleta de colores para eventos (cíclica)
const EVENT_COLORS = [
  { bg: '#FCE4EC', text: '#880E4F', border: '#F48FB1' }, // rosa
  { bg: '#E3F2FD', text: '#0D47A1', border: '#90CAF9' }, // azul
  { bg: '#E8F5E9', text: '#1B5E20', border: '#A5D6A7' }, // verde
  { bg: '#FFF9C4', text: '#F57F17', border: '#FFF176' }, // amarillo
  { bg: '#F3E5F5', text: '#4A148C', border: '#CE93D8' }, // morado
  { bg: '#FBE9E7', text: '#BF360C', border: '#FFAB91' }, // naranja
];

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

const toDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

// Genera la semana (Dom-Sáb) que contiene la fecha dada
const weekContaining = (d: Date): Date[] => {
  const dow = d.getDay();
  const start = addDays(d, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

// Extrae hora de un string ISO o "HH:MM" → minutos desde medianoche
const parseTime = (t?: string): number => {
  if (!t) return 9 * 60; // default 09:00
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 9 * 60;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
};

const minutesToY = (mins: number): number => (mins / 60) * HOUR_HEIGHT;

const formatHour = (h: number): string => {
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Assignment {
  id: string;
  due_date: string;
  start_time?: string;
  end_time?: string;
  workout?: {
    name: string;
    category?: string;
    duration?: number;
    exercises?: any[];
  };
  client?: { full_name: string; avatar_url?: string };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CalendarScreen() {
  const isDark = useColorScheme() === 'dark';

  const [trainerId, setTrainerId]         = useState<string | null>(null);
  const [assignments, setAssignments]     = useState<Assignment[]>([]);
  const [loading, setLoading]             = useState(true);
  const [today]                           = useState(new Date());
  const [selectedDate, setSelectedDate]   = useState(new Date());
  const [currentWeek, setCurrentWeek]     = useState(() => weekContaining(new Date()));
  const [currentTime, setCurrentTime]     = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Assignment | null>(null);

  const timelineRef = useRef<ScrollView>(null);
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  const C = {
    bg:        isDark ? '#0F172A' : '#FFFFFF',
    surface:   isDark ? '#1E293B' : '#F8FAFC',
    text:      isDark ? '#F1F5F9' : '#111827',
    sub:       isDark ? '#94A3B8' : '#6B7280',
    border:    isDark ? '#334155' : '#E5E7EB',
    headerBg:  isDark ? '#0F172A' : '#FFFFFF',
    todayRed:  '#E8401C',
    primary:   '#10B981',
    nowLine:   '#E8401C',
  };

  // ── Cargar assignments ─────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
        setLoading(true);
        try {
        const data = await getMyAssignments();

        //adaptamos datos al formato del calendario
        const adapted = data.map((a: any) => ({
          id: String(a.id),
          due_date: a.routine?.date || new Date().toISOString().split('T')[0],
          start_time: '09:00',
          end_time: '10:00',
          workout: {
            name: a.routine?.name || 'Rutina',
            duration: 60,
            exercises: a.routine?.exercises || [],
          },
          client: {
            full_name: 'Yo',
          },
        }));

        setAssignments(adapted);

        } catch (e) {
        console.error(e);
        } finally {
        setLoading(false);
        }
    };

    load();
    }, []);

  // ── Reloj en tiempo real ───────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Pulso en la línea de "ahora" ───────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 900,  useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 900,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Auto-scroll a la hora actual al cargar ─────────────────────────────────
  useEffect(() => {
    const mins  = currentTime.getHours() * 60 + currentTime.getMinutes();
    const y     = minutesToY(mins) - HOUR_HEIGHT * 1.5;
    setTimeout(() => timelineRef.current?.scrollTo({ y: Math.max(0, y), animated: true }), 400);
  }, []);

  // ── Navegación de semana ───────────────────────────────────────────────────
  const prevWeek = () => {
    const w = weekContaining(addDays(currentWeek[0], -7));
    setCurrentWeek(w);
  };
  const nextWeek = () => {
    const w = weekContaining(addDays(currentWeek[0],  7));
    setCurrentWeek(w);
  };
  const goToday = () => {
    const w = weekContaining(today);
    setCurrentWeek(w);
    setSelectedDate(today);
  };

  // ── Eventos del día seleccionado ───────────────────────────────────────────
  const eventsOfDay = assignments.filter(
    a => a.due_date === toDateString(selectedDate)
  );

  // ── Posición de la línea "ahora" ───────────────────────────────────────────
  const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const nowY    = minutesToY(nowMins);
  const showNowLine = isSameDay(selectedDate, today);

  // ── Color de evento por índice ─────────────────────────────────────────────
  const eventColor = (idx: number) => EVENT_COLORS[idx % EVENT_COLORS.length];

  // ─── RENDER MINI-CALENDARIO (cabecera) ──────────────────────────────────────

  const renderWeekHeader = () => (
    <View style={[s.weekHeader, { borderBottomColor: C.border, backgroundColor: C.headerBg }]}>
      {/* Mes y año + navegación */}
      <View style={s.monthRow}>
        <TouchableOpacity onPress={prevWeek} style={s.navBtn}>
          <ChevronLeft size={20} color={C.todayRed} />
        </TouchableOpacity>
        <Text style={[s.monthLabel, { color: C.text }]}>
          {MONTH_NAMES[currentWeek[0].getMonth()].charAt(0).toUpperCase() +
           MONTH_NAMES[currentWeek[0].getMonth()].slice(1)}{' '}
          {currentWeek[0].getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextWeek} style={s.navBtn}>
          <ChevronRight size={20} color={C.todayRed} />
        </TouchableOpacity>
      </View>

      {/* Días de la semana */}
      <View style={s.weekRow}>
        {currentWeek.map((d, i) => {
          const isToday    = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDate);
          const dateStr    = toDateString(d);
          const hasDot     = assignments.some(a => a.due_date === dateStr);

          return (
            <TouchableOpacity
              key={i}
              style={s.dayCol}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[s.dayName, { color: isSelected ? C.todayRed : C.sub }]}>
                {DAY_NAMES_SHORT[d.getDay()]}
              </Text>
              <View style={[
                s.dayCircle,
                isToday    && !isSelected && { borderWidth: 1.5, borderColor: C.todayRed },
                isSelected && { backgroundColor: C.todayRed },
              ]}>
                <Text style={[
                  s.dayNum,
                  { color: isSelected ? '#fff' : isToday ? C.todayRed : C.text },
                ]}>
                  {d.getDate()}
                </Text>
              </View>
              {hasDot && (
                <View style={[s.dot, { backgroundColor: isSelected ? '#fff' : C.todayRed }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─── RENDER TIMELINE ────────────────────────────────────────────────────────

  const renderTimeline = () => (
    <ScrollView ref={timelineRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <View style={[s.timeline, { height: HOUR_HEIGHT * 24 }]}>

        {/* Líneas de hora */}
        {HOURS.map(h => (
          <View key={h} style={[s.hourRow, { top: h * HOUR_HEIGHT, borderTopColor: C.border }]}>
            <Text style={[s.hourLabel, { color: C.sub }]}>
              {h === 0 ? '' : formatHour(h)}
            </Text>
            <View style={[s.hourLine, { backgroundColor: C.border }]} />
          </View>
        ))}

        {/* Eventos del día */}
        {eventsOfDay.map((ev, idx) => {
          const startMins = parseTime(ev.start_time);
          const duration  = ev.workout?.duration ?? 60;
          const endMins   = startMins + duration;
          const top       = minutesToY(startMins);
          const height    = Math.max(minutesToY(duration), HOUR_HEIGHT * 0.7);
          const color     = eventColor(idx);

          return (
            <TouchableOpacity
              key={ev.id}
              onPress={() => setSelectedEvent(ev)}
              style={[
                s.event,
                {
                  top,
                  height,
                  backgroundColor: isDark ? color.text + '22' : color.bg,
                  borderLeftColor: isDark ? color.border : color.text,
                },
              ]}
              activeOpacity={0.85}
            >
              <Text
                style={[s.eventTitle, { color: isDark ? color.border : color.text }]}
                numberOfLines={1}
              >
                {ev.workout?.name ?? 'Entrenamiento'}
              </Text>
              {height > 36 && (
                <Text
                  style={[s.eventSub, { color: isDark ? color.border + 'AA' : color.text + 'BB' }]}
                  numberOfLines={1}
                >
                  {ev.workout?.exercises?.map((e: any) => e.name).join(', ') || 'Sin ejercicios'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Línea de "ahora" */}
        {showNowLine && (
          <View style={[s.nowRow, { top: nowY }]}>
            <Animated.View style={[
              s.nowDot,
              { backgroundColor: C.nowLine, transform: [{ scale: pulseAnim }] },
            ]} />
            <View style={[s.nowLine, { backgroundColor: C.nowLine }]} />
          </View>
        )}
      </View>
    </ScrollView>
  );

  // ─── MODAL DETALLE EVENTO ─────────────────────────────────────────────────

  const renderEventModal = () => {
    if (!selectedEvent) return null;
    const idx   = eventsOfDay.findIndex(e => e.id === selectedEvent.id);
    const color = eventColor(idx >= 0 ? idx : 0);
    const start = parseTime(selectedEvent.start_time);
    const dur   = selectedEvent.workout?.duration ?? 60;
    const sh    = Math.floor(start / 60);
    const sm    = start % 60;
    const eh    = Math.floor((start + dur) / 60);
    const em    = (start + dur) % 60;
    const pad   = (n: number) => String(n).padStart(2, '0');

    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => setSelectedEvent(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setSelectedEvent(null)}>
          <View style={[
            s.eventModal,
            {
              backgroundColor: isDark ? '#1E293B' : '#fff',
              borderColor: isDark ? color.border + '55' : color.text + '33',
              borderLeftColor: isDark ? color.border : color.text,
            },
          ]}>
            {/* Cerrar */}
            <TouchableOpacity style={s.modalClose} onPress={() => setSelectedEvent(null)}>
              <Text style={{ color: C.sub, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>

            {/* Cabecera */}
            <Text style={[s.modalTitle, { color: C.text }]}>
              {selectedEvent.workout?.name ?? 'Entrenamiento'}
            </Text>
            <Text style={[s.modalTime, { color: isDark ? color.border : color.text }]}>
              {formatHour(sh)}:{pad(sm)} – {formatHour(eh)}:{pad(em)}
            </Text>

            <View style={[s.modalDivider, { backgroundColor: C.border }]} />

            {/* Info */}
            <View style={s.modalRow}>
              <Text style={s.modalIcon}>👤</Text>
              <View>
                <Text style={[s.modalLabel, { color: C.sub }]}>Cliente</Text>
                <Text style={[s.modalValue, { color: C.text }]}>
                  {selectedEvent.client?.full_name ?? 'Sin asignar'}
                </Text>
              </View>
            </View>

            {selectedEvent.workout?.category && (
              <View style={s.modalRow}>
                <Text style={s.modalIcon}>🏷️</Text>
                <View>
                  <Text style={[s.modalLabel, { color: C.sub }]}>Categoría</Text>
                  <Text style={[s.modalValue, { color: C.text }]}>
                    {selectedEvent.workout.category}
                  </Text>
                </View>
              </View>
            )}

            <View style={s.modalRow}>
              <Text style={s.modalIcon}>💪</Text>
              <View>
                <Text style={[s.modalLabel, { color: C.sub }]}>Ejercicios</Text>
                <Text style={[s.modalValue, { color: C.text }]}>
                  {selectedEvent.workout?.exercises?.map((e: any) => e.name).join(', ') || 'Sin ejercicios'}
                </Text>
              </View>
            </View>

            <View style={s.modalRow}>
              <Text style={s.modalIcon}>📅</Text>
              <View>
                <Text style={[s.modalLabel, { color: C.sub }]}>Fecha</Text>
                <Text style={[s.modalValue, { color: C.text }]}>
                  {DAY_NAMES_FULL[selectedDate.getDay()]},{' '}
                  {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ─── HEADER FECHA SELECCIONADA ─────────────────────────────────────────────

  const renderDayTitle = () => {
    const isToday = isSameDay(selectedDate, today);
    return (
      <View style={[s.dayTitle, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
        <Text style={[s.dayTitleText, { color: C.text }]}>
          {DAY_NAMES_FULL[selectedDate.getDay()]},{' '}
          {selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
          {isToday && (
            <Text style={{ color: C.todayRed, fontWeight: '700' }}> · Hoy</Text>
          )}
        </Text>
        <View style={s.dayTitleRight}>
          {eventsOfDay.length > 0 && (
            <View style={[s.eventsCountBadge, { backgroundColor: C.todayRed + '18' }]}>
              <Text style={[s.eventsCountText, { color: C.todayRed }]}>
                {eventsOfDay.length} entreno{eventsOfDay.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>

      {/* Nav bar superior */}
      <View style={[s.navbar, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={goToday}>
          <Text style={[s.todayBtn, { color: C.todayRed }]}>Hoy</Text>
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: C.text }]}>
          {MONTH_NAMES[selectedDate.getMonth()].charAt(0).toUpperCase() +
           MONTH_NAMES[selectedDate.getMonth()].slice(1)}{' '}
          {selectedDate.getFullYear()}
        </Text>
        <View style={s.navRight}>
          <TouchableOpacity style={s.iconBtn}>
            <Search size={19} color={C.todayRed} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <Plus size={22} color={C.todayRed} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mini calendario semanal */}
      {renderWeekHeader()}

      {/* Título día seleccionado */}
      {renderDayTitle()}

      {/* Timeline */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={[s.loadingText, { color: C.sub }]}>Cargando agenda…</Text>
        </View>
      ) : (
        renderTimeline()
      )}

      {/* Modal detalle */}
      {renderEventModal()}

      {/* Bottom tab bar estilo iOS */}
      <View style={[s.tabBar, { borderTopColor: C.border, backgroundColor: C.bg }]}>
        <TouchableOpacity style={s.tabItem}>
          <Text style={[s.tabLabel, { color: C.todayRed }]}>Hoy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem}>
          <AlignJustify size={22} color={C.sub} />
          <Text style={[s.tabLabel, { color: C.sub }]}>Calendarios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem}>
          <Inbox size={22} color={C.sub} />
          <Text style={[s.tabLabel, { color: C.sub }]}>Bandeja</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  // ── Navbar
  navbar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  todayBtn:    { fontSize: 17, fontWeight: '400' },
  navTitle:    { fontSize: 17, fontWeight: '600' },
  navRight:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn:     { padding: 6 },

  // ── Cabecera semana
  weekHeader:  { borderBottomWidth: 0.5 },
  monthRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  monthLabel:  { fontSize: 15, fontWeight: '600' },
  navBtn:      { padding: 6 },
  weekRow:     { flexDirection: 'row', paddingHorizontal: 8, paddingBottom: 8 },
  dayCol:      { flex: 1, alignItems: 'center', gap: 3 },
  dayName:     { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3 },
  dayCircle:   { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  dayNum:      { fontSize: 16, fontWeight: '400' },
  dot:         { width: 5, height: 5, borderRadius: 3 },

  // ── Título día
  dayTitle:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5 },
  dayTitleText:  { fontSize: 14, fontWeight: '600' },
  dayTitleRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventsCountBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  eventsCountText:  { fontSize: 12, fontWeight: '600' },

  // ── Timeline
  timeline: { position: 'relative', marginLeft: 56 },
  hourRow:  { position: 'absolute', left: -56, right: 0, flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 0.5 },
  hourLabel:{ width: 48, fontSize: 11, textAlign: 'right', paddingRight: 6, marginTop: -8 },
  hourLine: { flex: 1, height: 0.5, marginTop: 0 },

  // ── Eventos
  event: {
    position:    'absolute',
    left:         4,
    right:        4,
    borderRadius: 6,
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical:   5,
    overflow:     'hidden',
  },
  eventTitle: { fontSize: 13, fontWeight: '600' },
  eventSub:   { fontSize: 11, marginTop: 2 },

  // ── Línea de "ahora"
  nowRow: { position: 'absolute', left: -56, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  nowDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 48 },
  nowLine:{ flex: 1, height: 1.5 },

  // ── Loading
  loadingBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  // ── Modal detalle evento
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  eventModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 0.5,
    borderLeftWidth: 4,
    padding: 20,
    gap: 0,
  },
  modalClose:   { alignSelf: 'flex-end', padding: 4, marginBottom: 4 },
  modalTitle:   { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalTime:    { fontSize: 14, fontWeight: '500', marginBottom: 14 },
  modalDivider: { height: 0.5, marginBottom: 14 },
  modalRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  modalIcon:    { fontSize: 18, marginTop: 2 },
  modalLabel:   { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  modalValue:   { fontSize: 15, fontWeight: '500' },

  // ── Bottom tab bar
  tabBar:    { flexDirection: 'row', borderTopWidth: 0.5, paddingBottom: 20, paddingTop: 8 },
  tabItem:   { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel:  { fontSize: 10, fontWeight: '500' },
});