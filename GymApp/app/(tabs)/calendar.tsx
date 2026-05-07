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
    bg:      isDark ? '#0F172A' : '#FFFFFF',
    surface: isDark ? '#1E293B' : '#F8FAFC',
    text:    isDark ? '#F1F5F9' : '#1A1A1A',
    sub:     isDark ? '#94A3B8' : '#64748B',
    border:  isDark ? '#1E2D3D' : '#E5E7EB',
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
                    isToday && !isSelected && { backgroundColor: Colors.primaryLight },
                    isSelected && { backgroundColor: Colors.primaryLight },
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
                            ? C.border
                            : isSelected
                              ? '#fff'
                              : isToday
                                ? Colors.primary
                                : C.text,
                        },
                        (isToday || isSelected) && { fontWeight: '700' },
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
                          { backgroundColor: ev.status === 'confirmed' ? Colors.primary : Colors.primaryDark },
                        ]}
                        onPress={() => { setSelectedDate(day); setSelectedEvent(ev); }}
                        activeOpacity={0.8}
                      >
                        <View style={s.eventChipDot} />
                        <Text style={s.eventChipText} numberOfLines={1}>
                          {formatTime(ev.start_time)} {ev.workout?.name ?? 'Entreno'}
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
          <View style={[s.eventModal, { backgroundColor: isDark ? '#1E293B' : '#fff' }]}>

            {/* Handle */}
            <View style={s.modalHandle} />

            {/* Header verde */}
            <View style={s.modalHero}>
              <View style={s.modalHeroIcon}>
                <Text style={{ fontSize: 22 }}>🏋️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalHeroTitle} numberOfLines={2}>
                  {selectedEvent.workout?.name ?? 'Entrenamiento'}
                </Text>
                <Text style={s.modalHeroTime}>
                  {formatHour(sh)}:{pad(sm)} – {formatHour(eh)}:{pad(em)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedEvent(null)} style={s.modalCloseBtn}>
                <Text style={{ color: Colors.primaryMid, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Info fecha */}
            <View style={[s.modalInfoRow, { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark }]}>
              <Text style={{ fontSize: 16 }}>📅</Text>
              <View>
                <Text style={s.modalInfoLabel}>FECHA</Text>
                <Text style={s.modalInfoValue}>
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
                  {selectedEvent.status === 'confirmed' ? '✓ Confirmado' :
                   selectedEvent.status === 'declined'  ? '✗ Rechazado'  : '⏳ Pendiente'}
                </Text>
              </View>
            </View>

            <View style={[s.modalDivider, { backgroundColor: C.border }]} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {exercises.length === 0 ? (
                <View style={s.noExercises}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>💪</Text>
                  <Text style={[s.noExercisesTxt, { color: C.sub }]}>Sin ejercicios asignados</Text>
                </View>
              ) : blocks.map((blockExs, blockIdx) => (
                <View key={blockIdx} style={s.blockContainer}>
                  <View style={[s.blockHeader, {
                    borderLeftColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length],
                    backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] + '15',
                  }]}>
                    <View style={[s.blockDot, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]} />
                    <Text style={[s.blockTitle, { color: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]}>
                      Bloque {blockIdx + 1}
                    </Text>
                    <Text style={[s.blockCount, { color: C.sub }]}>
                      {blockExs.length} ejercicio{blockExs.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {blockExs.map((ex: any, exIdx: number) => (
                    <View
                      key={ex.id ?? exIdx}
                      style={[s.exRow, {
                        borderBottomColor: C.border,
                        backgroundColor: exIdx % 2 === 0
                          ? 'transparent'
                          : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      }]}
                    >
                      <View style={[s.exNumber, { backgroundColor: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] + '20' }]}>
                        <Text style={[s.exNumberText, { color: BLOCK_COLORS[blockIdx % BLOCK_COLORS.length] }]}>{exIdx + 1}</Text>
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
                      <Text style={s.btnConfirmText}>✓ Confirmar entreno</Text>
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
                      <Text style={s.btnDeclineText}>✕ No puedo entrenar</Text>
                    </TouchableOpacity>
                  </>
                )}
                {selectedEvent?.status === 'confirmed' && (
                  <View style={s.statusBanner}>
                    <Text style={s.statusBannerText}>✅ Entrenamiento confirmado</Text>
                  </View>
                )}
                {selectedEvent?.status === 'declined' && (
                  <View style={[s.statusBanner, { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[s.statusBannerText, { color: '#991B1B' }]}>❌ Entrenamiento rechazado</Text>
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
      <View style={{ gap: 16 }}>
        {activeWorkout.map((workout) => {
          const exercises = workout.workout?.exercises ?? [];

          return (
            <View
              key={workout.id}
              style={[
                s.activeWorkoutBox,
                {
                  backgroundColor: C.bg,
                  borderTopColor: Colors.primary + '33',
                },
              ]}
            >
              <View style={s.activeWorkoutHeader}>
                <View style={s.activeWorkoutHeroLeft}>
                  <View style={s.activeWorkoutIconBox}>
                    <Text style={{ fontSize: 20 }}>🔥</Text>
                  </View>

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
                        fontSize: 12,
                        color: Colors.primary,
                        fontWeight: '600',
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

              {exercises.map((ex: any) => (
                <View
                  key={`${workout.id}_${ex.id}`}
                  style={[
                    s.logCard,
                    {
                      backgroundColor: C.surface,
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
                      <Text style={s.logInputLabel}>
                        KG
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
                            backgroundColor: C.bg,
                          },
                        ]}
                      />
                    </View>

                    <View style={s.logInputWrap}>
                      <Text style={s.logInputLabel}>
                        REPS
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
                            backgroundColor: C.bg,
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
      <View style={s.hero}>
        <TouchableOpacity onPress={goToday} style={s.todayBtn}>
          <Text style={s.todayBtnText}>Hoy</Text>
        </TouchableOpacity>
        <View style={s.navCenter}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
            <ChevronLeft size={20} color={Colors.primaryMid} />
          </TouchableOpacity>
          <Text style={s.navTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
            <ChevronRight size={20} color={Colors.primaryMid} />
          </TouchableOpacity>
        </View>
        <View style={{ width: 60 }} />

        {/* Stats mensuales */}
        <View style={s.heroStats}>
          <View style={s.heroStatItem}>
            <Text style={s.heroStatVal}>{monthEvents.length}</Text>
            <Text style={s.heroStatLbl}>sesiones</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStatItem}>
            <Text style={s.heroStatVal}>{confirmedCount}</Text>
            <Text style={s.heroStatLbl}>confirmadas</Text>
          </View>
          <View style={s.heroStatDivider} />
          <View style={s.heroStatItem}>
            <Text style={s.heroStatVal}>{pendingCount}</Text>
            <Text style={s.heroStatLbl}>pendientes</Text>
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
            <View style={s.integratedWorkoutSection}>
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
    paddingTop: 10,
    paddingBottom: 14,
  },
  todayBtn: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 1,
  },
  todayBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primaryLight,
    minWidth: 160,
    textAlign: 'center',
  },
  navBtn: { padding: 4 },

  heroStats: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal:  { fontSize: 20, fontWeight: '700', color: '#EAF3DE' },
  heroStatLbl:  { fontSize: 11, color: '#97C459', marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: Colors.primary },

  // ── Day grid ──
  dayHeaderRow:  { flexDirection: 'row', borderBottomWidth: 0.5, paddingVertical: 7 },
  dayHeaderCell: { flex: 1, alignItems: 'center' },
  dayHeaderText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekRow:       { flexDirection: 'row', borderBottomWidth: 0.5, minHeight: 72 },
  dayCell:       { flex: 1, borderRightWidth: 0.5, paddingTop: 4, paddingHorizontal: 2, paddingBottom: 4 },
  dayCellHeader: { alignItems: 'center', marginBottom: 2 },
  dayNumCircle:  { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  dayNum:        { fontSize: 13, fontWeight: '400' },

  eventChips:    { gap: 2 },
  eventChip:     {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
    gap: 3, overflow: 'hidden',
  },
  eventChipDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)', flexShrink: 0 },
  eventChipText: { fontSize: 9, fontWeight: '600', color: '#fff', flex: 1 },
  moreText:      { fontSize: 9, paddingHorizontal: 4, marginTop: 1 },

  loadingBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },

  // ── Modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  eventModal: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  modalHeroIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  modalHeroTitle: {
    fontSize: 18, fontWeight: '700', color: '#EAF3DE',
    flex: 1,
  },
  modalHeroTime: {
    fontSize: 13, color: Colors.primaryMid, marginTop: 2,
  },
  modalCloseBtn: { padding: 4 },

  modalInfoRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 0.5,
    padding: 12, marginBottom: 14,
    gap: 10,
  },
  modalInfoLabel: {
    fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
    color: Colors.primaryMid, marginBottom: 2,
  },
  modalInfoValue: {
    fontSize: 13, fontWeight: '600',
    color: Colors.primaryLight, flex: 1,
  },
  statusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  modalDivider:  { height: 0.5, marginBottom: 14 },

  noExercises:   { alignItems: 'center', paddingVertical: 32 },
  noExercisesTxt:{ fontSize: 14 },

  blockContainer: { marginBottom: 10 },
  blockHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderRadius: 4, marginBottom: 4,
  },
  blockDot:   { width: 8, height: 8, borderRadius: 4 },
  blockTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  blockCount: { fontSize: 11 },

  exRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, gap: 10,
  },
  exNumber: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  exNumberText: { fontSize: 12, fontWeight: '700' },
  exInfo: { flex: 1, gap: 3 },
  exName: { fontSize: 13, fontWeight: '600' },
  exBadge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  exBadgeText: { fontSize: 10, fontWeight: '600' },
  exStats: { flexDirection: 'row', gap: 10 },
  exStat: { alignItems: 'center' },
  exStatValue: { fontSize: 15, fontWeight: '700' },
  exStatLabel: { fontSize: 10 },

  // Botones acción modal
  btnConfirm: {
    backgroundColor: Colors.primary,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  btnConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDecline: {
    borderWidth: 1.5, borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingVertical: 13, borderRadius: 14, alignItems: 'center',
  },
  btnDeclineText: { color: '#991B1B', fontWeight: '700', fontSize: 14 },
  statusBanner: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  statusBannerText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },

  modalCloseFullBtn: {
    marginTop: 14, paddingVertical: 13,
    borderRadius: 12, borderWidth: 0.5, alignItems: 'center',
  },
  modalCloseFullTxt: { fontSize: 14 },

  // ── Active Workout Panel ──
  activeWorkoutBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',

    padding: 14,
    borderRadius: 22,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,

    elevation: 4,
  },
  activeWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 10, fontWeight: '800',
    color: Colors.primary, letterSpacing: 1,
  },
  activeWorkoutTitle: {
    fontSize: 16, fontWeight: '700', marginTop: 1,
  },
  activeBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99,
  },
  activeBadgeText: {
    color: Colors.primary, fontSize: 11, fontWeight: '700',
  },

  logCard: {
    borderWidth: 1, borderRadius: 10,
    padding: 10, marginBottom: 8,
  },
  logExerciseName: { fontSize: 14, fontWeight: '700' },

  logInputsRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  logInputWrap: { flex: 1 },
  logInputLabel: {
    fontSize: 10, fontWeight: '700',
    color: Colors.primary, letterSpacing: 0.5,
    marginBottom: 4,
  },
  logInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    minHeight: 50,
  },
  saveLogBtn: {
    backgroundColor: Colors.primary,
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  saveLogBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  cancelWorkoutBtn: {
    marginTop: 10,
    borderWidth: 1, borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  cancelWorkoutText: { color: '#991B1B', fontWeight: '700', fontSize: 13 },
  
  integratedWorkoutSection: {
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 32,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

});