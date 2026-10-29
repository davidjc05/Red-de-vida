import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, ActivityIndicator,
  Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { getMyAssignments, confirmWorkout, saveWorkoutLog } from '../../services/api';
import { Colors } from '../../constants/colors';

const FC  = 'BarlowCondensed-ExtraBold';
const FB  = 'Barlow-Regular';
const FBB = 'Barlow-Bold';

const DAY_NAMES_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES_FULL  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MONTH_NAMES     = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const BLOCK_COLORS = ['#3B6D11', '#6366F1', '#F59E0B', '#EC4899', '#0EA5E9', '#22C55E'];

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

const formatTime = (t?: string) => t ? t.slice(0, 5) : '09:00';

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
    for (let d = 0; d < 7; d++) { week.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
    weeks.push(week);
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

export default function CalendarScreen() {
  const isDark = useColorScheme() === 'dark';
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [today] = useState(new Date());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<Assignment | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Assignment[]>([]);
  const [logs, setLogs] = useState<any>({});

  const C = {
    bg:      isDark ? '#111111' : '#F2F5EE',
    surface: isDark ? '#1A1A1A' : '#FFFFFF',
    text:    isDark ? '#F2F2F0' : '#1A1A1A',
    sub:     isDark ? '#A1A1A0' : '#5F5E5A',
    border:  isDark ? '#2A2A2A' : '#E3E6DD',
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getMyAssignments();
        if (!data || !Array.isArray(data)) { setAssignments([]); return; }
        const adapted = data.map((a: any) => ({
          id: String(a.id),
          status: a.status || 'pending',
          due_date: a.date?.split('T')[0],
          start_time: '18:06',
          end_time: '19:06',
          workout: {
            name: a.routine?.name || 'Rutina',
            duration: 60,
            exercises: (a.routine?.blocks?.flatMap((block: any) =>
              block.exercises.map((be: any) => ({
                id: be.exercise?.id, name: be.exercise?.name,
                muscle_group: be.exercise?.muscle_group,
                description: be.exercise?.description,
                image_url: be.exercise?.image_url,
                video_url: be.exercise?.video_url,
                sets: be.sets, reps: be.reps,
              }))
            ) || []),
          },
          client: { full_name: 'Yo' },
        }));
        setAssignments(adapted);
        const confirmed = adapted.filter(
          (a: Assignment) => a.status === 'confirmed'
        );

        setActiveWorkout(confirmed);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const grid = getMonthGrid(viewYear, viewMonth);
  const eventsOnDay = (d: Date) => assignments.filter(a => a.due_date === toDateString(d));
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(today); };

  // ── Stats del mes ────────────────────────────────────────────────────────────
  const monthEvents = assignments.filter(a => {
    const d = new Date(a.due_date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const confirmedCount = monthEvents.filter(a => a.status === 'confirmed').length;
  const pendingCount   = monthEvents.filter(a => a.status === 'pending').length;

  // ── Month Grid ───────────────────────────────────────────────────────────────
  const MonthGrid = () => (
    <View style={{ flex: 1 }}>
      <View style={[s.dayHeaderRow, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
        {DAY_NAMES_SHORT.map((d, i) => (
          <View key={i} style={s.dayHeaderCell}>
            <Text style={[s.dayHeaderText, { color: C.sub }]}>{d}</Text>
          </View>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {grid.map((week, wi) => (
          <View key={wi} style={[s.weekRow, { borderBottomColor: C.border }]}>
            {week.map((day, di) => {
              const isCurrentMonth = day.getMonth() === viewMonth;
              const isToday        = isSameDay(day, today);
              const isSelected     = isSameDay(day, selectedDate);
              const events         = eventsOnDay(day);
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    s.dayCell,
                    { borderRightColor: C.border },
                    isSelected && { backgroundColor: isDark ? Colors.primary + '26' : Colors.primaryLight },
                  ]}
                  onPress={() => setSelectedDate(day)}
                  activeOpacity={0.7}
                >
                  <View style={s.dayCellHeader}>
                    <View style={[
                      s.dayNumCircle,
                      isSelected && { backgroundColor: Colors.primary },
                      isToday && !isSelected && { backgroundColor: Colors.primary + '33' },
                    ]}>
                      <Text style={[
                        s.dayNum,
                        {
                          color: !isCurrentMonth
                            ? C.sub + '88'
                            : isSelected
                              ? '#fff'
                              : isToday
                                ? Colors.primary
                                : C.text,
                        },
                        (isToday || isSelected) && { fontFamily: FBB },
                      ]}>
                        {day.getDate()}
                      </Text>
                    </View>
                  </View>
                  <View style={s.eventChips}>
                    {events.slice(0, 2).map((ev, ei) => (
                      <TouchableOpacity
                        key={ev.id}
                        style={[
                          s.eventChip,
                          ev.status === 'confirmed'
                            ? { backgroundColor: Colors.primary }
                            : ev.status === 'declined'
                              ? { backgroundColor: C.border }
                              : { borderStyle: 'dashed', borderColor: Colors.primary },
                        ]}
                        onPress={() => { setSelectedDate(day); setSelectedEvent(ev); }}
                        activeOpacity={0.8}
                        accessibilityLabel={`${formatTime(ev.start_time)} ${ev.workout?.name ?? 'Entreno'}`}
                      >
                        <Text
                          style={[
                            s.eventChipText,
                            {
                              color: ev.status === 'confirmed'
                                ? '#fff'
                                : ev.status === 'declined'
                                  ? C.sub
                                  : Colors.primary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {ev.workout?.name ?? 'Entreno'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {events.length > 2 && (
                      <Text style={[s.moreText, { color: C.sub }]}>+{events.length - 2} más</Text>
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

  // ── Event Detail Modal ───────────────────────────────────────────────────────
  const EventModal = () => {
    if (!selectedEvent) return null;
    const start = parseTime(selectedEvent.start_time);
    const dur   = selectedEvent.workout?.duration ?? 60;
    const sh = Math.floor(start / 60), sm = start % 60;
    const eh = Math.floor((start + dur) / 60), em = (start + dur) % 60;
    const exercises = selectedEvent.workout?.exercises ?? [];
    const BLOCK_SIZE = 3;
    const blocks = exercises.length === 0 ? [] :
      Array.from({ length: Math.ceil(exercises.length / BLOCK_SIZE) }, (_, i) =>
        exercises.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
      );

    return (
      <Modal transparent animationType="slide" visible onRequestClose={() => setSelectedEvent(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.eventModal, { backgroundColor: C.surface }]}>

            {/* Handle */}
            <View style={s.modalHandle} />

            {/* Header verde */}
            <View style={s.modalHero}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalHeroTitle, { color: C.text }]} numberOfLines={2}>
                  {selectedEvent.workout?.name ?? 'Entrenamiento'}
                </Text>
                <Text style={[s.modalHeroTime, { color: C.sub }]}>
                  {formatHour(sh)}:{pad(sm)} – {formatHour(eh)}:{pad(em)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEvent(null)} style={s.modalCloseBtn}>
                <Text style={{ color: C.sub, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Info fecha */}
            <View style={[s.modalInfoRow, { backgroundColor: C.bg, borderColor: C.border }]}>
              <View>
                <Text style={[s.modalInfoLabel, { color: C.sub }]}>Fecha</Text>
                <Text style={[s.modalInfoValue, { color: C.text }]}>
                  {DAY_NAMES_FULL[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]},
                  {' '}{selectedDate.getDate()} de {MONTH_NAMES[selectedDate.getMonth()]}
                </Text>
              </View>
              {/* Badge estado */}
              <View style={[
                s.statusBadge,
                selectedEvent.status === 'confirmed' && { backgroundColor: Colors.primaryLight },
                selectedEvent.status === 'declined'  && { backgroundColor: '#FEE2E2' },
                selectedEvent.status === 'pending'   && { backgroundColor: '#FEF3C7' },
              ]}>
                <Text style={[
                  s.statusBadgeText,
                  selectedEvent.status === 'confirmed' && { color: Colors.primary },
                  selectedEvent.status === 'declined'  && { color: '#991B1B' },
                  selectedEvent.status === 'pending'   && { color: '#92400E' },
                ]}>
                  {selectedEvent.status === 'confirmed' ? 'Confirmado' :
                   selectedEvent.status === 'declined'  ? 'Rechazado'  : 'Pendiente'}
                </Text>
              </View>
            </View>

            <View style={[s.modalDivider, { backgroundColor: C.border }]} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {exercises.length === 0 ? (
                <View style={s.noExercises}>
                  <Text style={[s.noExercisesTxt, { color: C.sub }]}>Sin ejercicios asignados</Text>
                </View>
              ) : blocks.map((blockExs, blockIdx) => (
                <View key={blockIdx} style={s.blockContainer}>
                  <View style={[s.blockHeader, { borderBottomColor: C.border }]}>
                    <View style={[s.blockDot, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]} />
                    <Text style={[s.blockTitle, { color: C.text }]}>
                      Bloque {blockIdx + 1}
                    </Text>
                    <Text style={[s.blockCount, { color: C.sub }]}>
                      {blockExs.length} ejercicio{blockExs.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {blockExs.map((ex: any, exIdx: number) => (
                    <View
                      key={ex.id ?? exIdx}
                      style={[s.exRow, { borderBottomColor: C.border }]}
                    >
                      <View style={s.exNumber}>
                        <Text style={[s.exNumberText, { color: C.sub }]}>{exIdx + 1}</Text>
                      </View>
                      <View style={s.exInfo}>
                        <Text style={[s.exName, { color: C.text }]}>{ex.name}</Text>
                        <View style={[s.exBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : Colors.primaryLight }]}>
                          <Text style={[s.exBadgeText, { color: Colors.primary }]}>{ex.muscle_group}</Text>
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

              {/* Botones de acción */}
              <View style={{ gap: 10, marginTop: 20, paddingHorizontal: 4 }}>
                {selectedEvent?.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      style={s.btnConfirm}
                      onPress={async () => {
                        try {
                          await confirmWorkout(Number(selectedEvent.id), 'confirmed');
                          const updated = { ...selectedEvent, status: 'confirmed' };

                          setAssignments(prev =>
                            prev.map(a =>
                              a.id === selectedEvent.id ? updated : a
                            )
                          );

                          setActiveWorkout(prev => [
                            ...prev,
                            updated,
                          ]);

                          setSelectedEvent(null);
                        } catch (e) { console.log(e); }
                      }}
                    >
                      <Text style={s.btnConfirmText}>Confirmar entreno</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.btnDecline}
                      onPress={async () => {
                        try {
                          await confirmWorkout(Number(selectedEvent.id), 'declined');
                          setAssignments(prev => prev.map(a => a.id === selectedEvent.id ? { ...a, status: 'declined' } : a));
                          setSelectedEvent({ ...selectedEvent, status: 'declined' });
                        } catch (e) { console.log(e); }
                      }}
                    >
                      <Text style={s.btnDeclineText}>No puedo entrenar</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedEvent?.status === 'confirmed' && (
                  <View style={s.statusBanner}>
                    <Text style={s.statusBannerText}>Entrenamiento confirmado</Text>
                  </View>
                )}
                {selectedEvent?.status === 'declined' && (
                  <View style={[s.statusBanner, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[s.statusBannerText, { color: '#991B1B' }]}>Entrenamiento rechazado</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={[s.modalCloseFullBtn, { borderColor: C.border }]}
                onPress={() => setSelectedEvent(null)}
              >
                <Text style={[s.modalCloseFullTxt, { color: C.sub }]}>Cerrar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Active Workout Panel ─────────────────────────────────────────────────────
  const ActiveWorkoutPanel = () => {
    if (activeWorkout.length === 0) return null;

    return (
      <View style={{ gap: 12 }}>
        {activeWorkout.map((workout) => {
          const exercises = workout.workout?.exercises ?? [];

          return (
            <View
              key={workout.id}
              style={[
                s.activeWorkoutBox,
                {
                  backgroundColor: C.surface,
                  borderColor: C.border,
                },
              ]}
            >
              <View style={s.activeWorkoutHeader}>
                <View style={s.activeWorkoutHeroLeft}>
                  <View>
                    <Text style={s.activeWorkoutEyebrow}>
                      ENTRENO ACTIVO
                    </Text>

                    <Text
                      style={[
                        s.activeWorkoutTitle,
                        { color: C.text },
                      ]}
                    >
                      {workout.workout?.name ?? 'Entrenamiento'}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: C.sub,
                        fontFamily: FB,
                        marginTop: 2,
                      }}
                    >
                      {
                        DAY_NAMES_FULL[
                          new Date(workout.due_date).getDay() === 0
                            ? 6
                            : new Date(workout.due_date).getDay() - 1
                        ]
                      }
                      {' · '}
                      {new Date(workout.due_date).getDate()}
                      {' de '}
                      {
                        MONTH_NAMES[
                          new Date(workout.due_date).getMonth()
                        ]
                      }
                    </Text>
                  </View>
                </View>

                <View style={s.activeBadge}>
                  <Text style={s.activeBadgeText}>
                    Confirmado
                  </Text>
                </View>
              </View>

              {exercises.map((ex: any, exIndex: number) => (
                <View
                  key={`${workout.id}_${ex.id}_${exIndex}`}
                  style={[
                    s.logCard,
                    {
                      backgroundColor: C.bg,
                      borderColor: C.border,
                    },
                  ]}
                >
                  <View style={{ marginBottom: 10 }}>
                    <Text
                      style={[
                        s.logExerciseName,
                        { color: C.text },
                      ]}
                    >
                      {ex.name}
                    </Text>
                  </View>

                  <View style={s.logInputsRow}>
                    <View style={s.logInputWrap}>
                      <Text style={[s.logInputLabel, { color: C.sub }]}>
                        Kg
                      </Text>

                      <TextInput
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={
                          logs[`${workout.id}_${ex.id}`]?.kg || ''
                        }
                        onChangeText={(t) =>
                          setLogs((prev: any) => ({
                            ...prev,
                            [`${workout.id}_${ex.id}`]: {
                              ...prev[`${workout.id}_${ex.id}`],
                              kg: t,
                            },
                          }))
                        }
                        style={[
                          s.logInput,
                          {
                            color: C.text,
                            borderColor: C.border,
                            backgroundColor: C.surface,
                          },
                        ]}
                      />
                    </View>

                    <View style={s.logInputWrap}>
                      <Text style={[s.logInputLabel, { color: C.sub }]}>
                        Reps
                      </Text>

                      <TextInput
                        placeholder="0"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        value={
                          logs[`${workout.id}_${ex.id}`]?.reps || ''
                        }
                        onChangeText={(t) =>
                          setLogs((prev: any) => ({
                            ...prev,
                            [`${workout.id}_${ex.id}`]: {
                              ...prev[`${workout.id}_${ex.id}`],
                              reps: t,
                            },
                          }))
                        }
                        style={[
                          s.logInput,
                          {
                            color: C.text,
                            borderColor: C.border,
                            backgroundColor: C.surface,
                          },
                        ]}
                      />
                    </View>

                    <TouchableOpacity
                      style={s.saveLogBtn}
                      onPress={async () => {
                        try {
                          await saveWorkoutLog({
                            assignment_id: Number(workout.id),
                            exercise_id: ex.id,
                            kg: Number(
                              logs[`${workout.id}_${ex.id}`]?.kg || 0
                            ),
                            reps: Number(
                              logs[`${workout.id}_${ex.id}`]?.reps || 0
                            ),
                          });
                        } catch (e) {
                          console.log(e);
                        }
                      }}
                    >
                      <Text style={s.saveLogBtnText}>
                        ✓
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={s.cancelWorkoutBtn}
                onPress={async () => {
                  try {
                    await confirmWorkout(
                      Number(workout.id),
                      'declined'
                    );

                    setAssignments((prev) =>
                      prev.map((a) =>
                        a.id === workout.id
                          ? { ...a, status: 'declined' }
                          : a
                      )
                    );

                    setActiveWorkout((prev) =>
                      prev.filter((w) => w.id !== workout.id)
                    );
                  } catch (e) {
                    console.log(e);
                  }
                }}
              >
                <Text style={s.cancelWorkoutText}>
                  Cancelar entreno
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>

      {/* ── Navbar con hero verde ── */}
      <View style={[s.hero, { backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={goToday} style={s.todayBtn}>
          <Text style={s.todayBtnText}>Hoy</Text>
        </TouchableOpacity>
        <View style={s.navCenter}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <ChevronLeft size={20} color={C.text} />
          </TouchableOpacity>
          <Text style={[s.navTitle, { color: C.text }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <ChevronRight size={20} color={C.text} />
          </TouchableOpacity>
        </View>
        <View style={{ width: 60 }} />

        {/* Stats mensuales */}
        <View style={[s.heroStats, { backgroundColor: C.surface, borderColor: C.border }]}>
          <View style={s.heroStatItem}>
            <Text style={[s.heroStatVal, { color: C.text }]}>{monthEvents.length}</Text>
            <Text style={[s.heroStatLbl, { color: C.sub }]}>sesiones</Text>
          </View>
          <View style={[s.heroStatDivider, { backgroundColor: C.border }]} />
          <View style={s.heroStatItem}>
            <Text style={[s.heroStatVal, { color: C.text }]}>{confirmedCount}</Text>
            <Text style={[s.heroStatLbl, { color: C.sub }]}>confirmadas</Text>
          </View>
          <View style={[s.heroStatDivider, { backgroundColor: C.border }]} />
          <View style={s.heroStatItem}>
            <Text style={[s.heroStatVal, { color: C.text }]}>{pendingCount}</Text>
            <Text style={[s.heroStatLbl, { color: C.sub }]}>pendientes</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={[s.loadingText, { color: C.sub }]}>Cargando agenda…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
        >
          <MonthGrid />

          {activeWorkout.length > 0 && (
            <View style={[s.integratedWorkoutSection, { backgroundColor: C.bg, borderTopColor: C.border }]}>
              <ActiveWorkoutPanel />
            </View>
          )}
        </ScrollView>
      )}

      <EventModal />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  // ── Hero ──
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  todayBtn: {
    position: 'absolute',
    left: 16,
    top: 8,
    height: 44,
    justifyContent: 'center',
    paddingRight: 12,
    zIndex: 1,
  },
  todayBtnText: {
    fontSize: 15,
    fontFamily: FBB,
    color: Colors.primary,
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 10,
  },
  navTitle: {
    fontSize: 26,
    fontFamily: FC,
    color: Colors.primaryLight,
    minWidth: 160,
    textAlign: 'center',
  },
  navBtn: { padding: 12 },

  heroStats: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal:  { fontSize: 28, lineHeight: 30, fontFamily: FC, color: '#EAF3DE' },
  heroStatLbl:  { fontSize: 12, fontFamily: FB, color: '#97C459', marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: Colors.primary },

  // ── Day grid ──
  dayHeaderRow:  { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 8 },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 12, fontFamily: FBB },
  weekRow:       { flexDirection: 'row', borderBottomWidth: 0.5, minHeight: 76 },
  dayCell:       { flex: 1, borderRightWidth: 0.5, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 4 },
  dayCellHeader: { alignItems: 'center', marginBottom: 3 },
  dayNumCircle:  { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dayNum:        { fontSize: 14, fontFamily: FB },

  eventChips:    { gap: 2 },
  eventChip:     {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: 'transparent',
    gap: 3, overflow: 'hidden',
  },
  eventChipDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  eventChipText: { fontSize: 11, fontFamily: FBB, color: '#fff', flex: 1 },
  moreText:      { fontSize: 11, fontFamily: FB, paddingHorizontal: 4, marginTop: 1 },

  loadingBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: FB },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  eventModal: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 16,
  },
  modalHeroIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  modalHeroTitle: {
    fontSize: 30, lineHeight: 32, fontFamily: FC, color: '#EAF3DE',
    flex: 1,
  },
  modalHeroTime: {
    fontSize: 14, fontFamily: FB, color: Colors.primaryMid, marginTop: 4,
  },
  modalCloseBtn: { padding: 10 },

  modalInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    padding: 12, marginBottom: 14,
    gap: 10,
  },
  modalInfoLabel: {
    fontSize: 12, fontFamily: FB,
    color: Colors.primaryMid, marginBottom: 2,
  },
  modalInfoValue: {
    fontSize: 14, fontFamily: FBB,
    color: Colors.primaryLight, flex: 1,
  },
  statusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  statusBadgeText: { fontSize: 12, fontFamily: FBB },

  modalDivider:  { height: 0.5, marginBottom: 14 },

  noExercises:   { alignItems: 'center', paddingVertical: 32 },
  noExercisesTxt:{ fontSize: 14, fontFamily: FB },

  blockContainer: { marginBottom: 12 },
  blockHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, paddingVertical: 8,
    borderBottomWidth: 1, marginBottom: 2,
  },
  blockDot:   { width: 8, height: 8, borderRadius: 4 },
  blockTitle: { fontSize: 15, fontFamily: FBB, flex: 1 },
  blockCount: { fontSize: 12, fontFamily: FB },

  exRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 12,
    borderBottomWidth: 0.5, gap: 10,
  },
  exNumber: { width: 20, alignItems: 'center' },
  exNumberText: { fontSize: 13, fontFamily: FBB },
  exInfo: { flex: 1, gap: 4 },
  exName: { fontSize: 15, fontFamily: FBB },
  exBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  exBadgeText: { fontSize: 11, fontFamily: FBB },
  exStats: { flexDirection: 'row', gap: 14 },
  exStat: { alignItems: 'center' },
  exStatValue: { fontSize: 17, fontFamily: FBB },
  exStatLabel: { fontSize: 11, fontFamily: FB },

  // Botones acción modal
  btnConfirm: {
    backgroundColor: Colors.primary,
    paddingVertical: 15, borderRadius: 12, alignItems: 'center',
  },
  btnConfirmText: { color: '#fff', fontFamily: FBB, fontSize: 16 },
  btnDecline: {
    borderWidth: 1, borderColor: '#FCA5A5',
    backgroundColor: 'transparent',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  btnDeclineText: { color: '#D93B3A', fontFamily: FBB, fontSize: 15 },
  statusBanner: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  statusBannerText: { color: Colors.primary, fontFamily: FBB, fontSize: 15 },

  modalCloseFullBtn: {
    marginTop: 14, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1, alignItems: 'center',
  },
  modalCloseFullTxt: { fontSize: 14, fontFamily: FB },

  // ── Active Workout Panel ──
  activeWorkoutBox: {
    borderWidth: 1,
    borderColor: '#E3E6DD',
    backgroundColor: '#FFFFFF',

    padding: 16,
    borderRadius: 14,
  },
  activeWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  activeWorkoutHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeWorkoutIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  activeWorkoutEyebrow: {
    fontSize: 11, fontFamily: FBB,
    color: Colors.primary, letterSpacing: 1.5,
  },
  activeWorkoutTitle: {
    fontSize: 26, lineHeight: 28, fontFamily: FC, marginTop: 2,
  },
  activeBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  activeBadgeText: {
    color: Colors.primary, fontSize: 12, fontFamily: FBB,
  },

  logCard: {
    borderWidth: 1, borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  logExerciseName: { fontSize: 15, fontFamily: FBB },

  logInputsRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  logInputWrap: { flex: 1 },
  logInputLabel: {
    fontSize: 12, fontFamily: FBB,
    color: Colors.primary,
    marginBottom: 4,
  },
  logInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontFamily: FBB,
    textAlign: 'center',
    minHeight: 48,
  },
  saveLogBtn: {
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  saveLogBtnText: { color: '#fff', fontFamily: FBB, fontSize: 18 },

  cancelWorkoutBtn: {
    marginTop: 10,
    borderWidth: 1, borderColor: '#FCA5A5',
    backgroundColor: 'transparent',
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
  },
  cancelWorkoutText: { color: '#D93B3A', fontFamily: FBB, fontSize: 14 },
  
  integratedWorkoutSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    backgroundColor: '#F2F5EE',
    borderTopWidth: 1,
    borderTopColor: '#E3E6DD',
  },

});
