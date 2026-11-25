import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { getClientHistory, ClientHistory, HistoryWorkout } from '../services/api';

// Seguimiento de clientes (entrenadora): al tocar un cliente se despliegan todos sus entrenos
// con su día; al tocar un entreno se despliegan sus ejercicios con peso y repeticiones.

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  confirmed: { label: 'Hecho', bg: '#DCFCE7', fg: '#166534' },
  declined: { label: 'Rechazado', bg: '#FEE2E2', fg: '#991B1B' },
  pending: { label: 'Pendiente', bg: '#FEF3C7', fg: '#92400E' },
};

function formatDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Props = { C: any; clients: { id: number; name: string; email: string }[] };

export default function ClientTracking({ C, clients }: Props) {
  const [openClient, setOpenClient] = useState<number | null>(null);
  const [openWorkout, setOpenWorkout] = useState<number | null>(null);
  const [cache, setCache] = useState<Record<number, ClientHistory>>({});
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleClient = async (id: number) => {
    setOpenWorkout(null);
    setError(null);
    if (openClient === id) { setOpenClient(null); return; }
    setOpenClient(id);
    setLoading(id);
    try {
      // se vuelve a pedir cada vez que se abre, para ver los últimos pesos registrados
      const data = await getClientHistory(id);
      setCache(prev => ({ ...prev, [id]: data }));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar el seguimiento');
    } finally {
      setLoading(null);
    }
  };

  if (clients.length === 0) return null;

  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={[s.title, { color: C.text }]}>Seguimiento</Text>
        <Text style={[s.sub, { color: C.textSub }]}>Toca un cliente para ver sus entrenos</Text>
      </View>

      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        {clients.map((c, i) => {
          const isOpen = openClient === c.id;
          const history = cache[c.id];
          return (
            <View key={c.id} style={i < clients.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.border } : undefined}>
              <TouchableOpacity
                style={s.clientRow}
                onPress={() => toggleClient(c.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`Entrenos de ${c.name}`}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[s.clientName, { color: C.text }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[s.clientEmail, { color: C.textSub }]} numberOfLines={1}>{c.email}</Text>
                </View>
                {isOpen ? <ChevronUp size={18} color={C.textSub} /> : <ChevronDown size={18} color={C.textSub} />}
              </TouchableOpacity>

              {isOpen && (
                <View style={[s.body, { borderTopColor: C.border }]}>
                  {loading === c.id && <ActivityIndicator style={{ margin: 12 }} />}
                  {error && loading !== c.id && !history && <Text style={[s.empty, { color: '#991B1B' }]}>{error}</Text>}
                  {history && history.workouts.length === 0 && (
                    <Text style={[s.empty, { color: C.textSub }]}>Todavía no tiene entrenos asignados.</Text>
                  )}
                  {history && history.workouts.map(w => (
                    <Workout
                      key={w.assignment_id}
                      w={w}
                      C={C}
                      open={openWorkout === w.assignment_id}
                      onToggle={() => setOpenWorkout(openWorkout === w.assignment_id ? null : w.assignment_id)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Workout({ w, C, open, onToggle }: { w: HistoryWorkout; C: any; open: boolean; onToggle: () => void }) {
  const st = STATUS[w.status] ?? STATUS.pending;
  return (
    <View style={[s.workout, { borderColor: C.border, backgroundColor: C.bg }]}>
      <TouchableOpacity
        style={s.workoutRow}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.day, { color: C.text }]}>{formatDay(w.date)}</Text>
          <Text style={[s.routine, { color: C.textSub }]} numberOfLines={1}>{w.routine_name}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: st.bg }]}>
          <Text style={[s.pillText, { color: st.fg }]}>{st.label}</Text>
        </View>
        {open ? <ChevronUp size={16} color={C.textSub} /> : <ChevronDown size={16} color={C.textSub} />}
      </TouchableOpacity>

      {open && (
        <View style={[s.exercises, { borderTopColor: C.border }]}>
          {w.note ? <Text style={[s.note, { color: C.textSub }]}>Nota: {w.note}</Text> : null}
          {w.exercises.length === 0 && (
            <Text style={[s.empty, { color: C.textSub }]}>Esta rutina no tiene ejercicios.</Text>
          )}
          {w.exercises.map((e, idx) => {
            const sets = e.sets ?? [];
            return (
              <View key={`${e.exercise_id}-${idx}`}>
                <View style={s.exRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.exName, { color: C.text }]}>{e.name}</Text>
                    {e.planned_sets != null && (
                      <Text style={[s.exPlan, { color: C.textSub }]}>Plan: {e.planned_sets} × {e.planned_reps}</Text>
                    )}
                  </View>
                  {!e.logged && <Text style={[s.exPlan, { color: C.textSub }]}>Sin registrar</Text>}
                  {e.logged && sets.length <= 1 && (
                    <Text style={[s.exLog, { color: C.text }]}>{e.kg} kg × {e.reps} reps</Text>
                  )}
                </View>
                {e.logged && sets.length > 1 && (
                  <View style={s.setsList}>
                    {sets.map(st => (
                      <View key={st.set_number} style={s.setRow}>
                        <Text style={[s.exPlan, { color: C.textSub }]}>Serie {st.set_number}</Text>
                        <Text style={[s.exLog, { color: C.text }]}>{st.kg} kg × {st.reps} reps</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 12, marginBottom: 8, marginTop: 16 },
  header: { gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  sub: { fontSize: 13 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8, paddingHorizontal: 16 },
  clientName: { fontSize: 15, fontWeight: '700' },
  clientEmail: { fontSize: 12 },
  body: { borderTopWidth: 1, padding: 12, gap: 8 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  workout: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  day: { fontSize: 14, fontWeight: '700' },
  routine: { fontSize: 12 },
  pill: { paddingHorizontal: 10, height: 22, borderRadius: 99, justifyContent: 'center' },
  pillText: { fontSize: 12, fontWeight: '700' },
  exercises: { borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  note: { fontSize: 12, fontStyle: 'italic', paddingBottom: 4 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  exName: { fontSize: 14, fontWeight: '600' },
  exPlan: { fontSize: 12 },
  exLog: { fontSize: 14, fontWeight: '700' },
  setsList: { paddingLeft: 12, paddingBottom: 6, gap: 2 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
