import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { saveExerciseSets, SetEntry } from '../services/api';
import { notify } from '../services/ui';
import { Colors } from '../constants/colors';

// Registro por series de UN ejercicio de un entreno: una fila por serie con su peso (kg) y
// sus repeticiones. "Guardar series" envía todas de una vez; las filas vacías se ignoran.

const FBB = 'Barlow-Bold';
const FB = 'Barlow-Regular';
const MAX_SETS = 20; // igual que en el servidor

type Row = { kg: string; reps: string };

type Props = {
  assignmentId: number;
  exerciseId: number;
  name: string;
  plannedSets?: number;
  plannedReps?: number;
  initial: SetEntry[]; // series que ya estaban guardadas
  C: { bg: string; surface: string; text: string; sub: string; border: string };
  onSaved?: (sets: SetEntry[]) => void;
};

const fmt = (n: number | null | undefined) => (n == null ? '' : String(n));

// Filas iniciales: las series guardadas y, si faltan respecto al plan, filas vacías hasta completarlo.
export function buildRows(initial: SetEntry[], plannedSets?: number): Row[] {
  const rows: Row[] = initial.map(s => ({ kg: fmt(s.kg), reps: fmt(s.reps) }));
  const target = Math.min(Math.max(plannedSets ?? 3, 1), MAX_SETS);
  while (rows.length < target) rows.push({ kg: '', reps: '' });
  return rows;
}

// Quita todo lo que no sea número; acepta coma decimal ("22,5" -> "22.5") y solo un punto.
const cleanKg = (t: string) => {
  const x = t.replace(',', '.').replace(/[^0-9.]/g, '');
  const i = x.indexOf('.');
  return i === -1 ? x : x.slice(0, i + 1) + x.slice(i + 1).replace(/\./g, '');
};
const cleanReps = (t: string) => t.replace(/[^0-9]/g, '');

export default function SetLogger({ assignmentId, exerciseId, name, plannedSets, plannedReps, initial, C, onSaved }: Props) {
  const [rows, setRows] = useState<Row[]>(() => buildRows(initial, plannedSets));
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(initial.length > 0);
  const [saving, setSaving] = useState(false);

  const edit = (i: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const addSet = () => {
    // la nueva serie empieza con los mismos datos que la anterior (casi siempre se repite el peso)
    setRows(prev => [...prev, prev.length ? { ...prev[prev.length - 1] } : { kg: '', reps: '' }]);
    setDirty(true);
  };
  const removeSet = (i: number) => {
    setRows(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
    setDirty(true);
  };

  const save = async () => {
    const sets: { kg: number; reps: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.kg === '' && r.reps === '') continue; // fila vacía: no se guarda
      const kg = r.kg === '' || r.kg === '.' ? 0 : Number(r.kg);
      const reps = r.reps === '' ? 0 : parseInt(r.reps, 10);
      if (!Number.isFinite(kg) || kg > 1000 || reps > 1000) {
        notify('Revisa la serie ' + (i + 1), 'El peso y las repeticiones tienen que ser números razonables.');
        return;
      }
      sets.push({ kg, reps });
    }
    setSaving(true);
    try {
      await saveExerciseSets({ assignment_id: assignmentId, exercise_id: exerciseId, sets });
      setDirty(false);
      setSaved(sets.length > 0);
      onSaved?.(sets.map((s, idx) => ({ set_number: idx + 1, ...s })));
    } catch (e: any) {
      notify('No se pudo guardar', e?.message ?? 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const input = [s.input, { color: C.text, borderColor: C.border, backgroundColor: C.surface }];

  return (
    <View style={[s.card, { backgroundColor: C.bg, borderColor: C.border }]}>
      <View style={s.head}>
        <Text style={[s.name, { color: C.text }]} numberOfLines={2}>{name}</Text>
        {plannedSets != null && (
          <Text style={[s.plan, { color: C.sub }]}>Plan: {plannedSets} × {plannedReps ?? '–'}</Text>
        )}
      </View>

      <View style={s.labels}>
        <Text style={[s.label, { color: C.sub, width: 52 }]}>Serie</Text>
        <Text style={[s.label, { color: C.sub, flex: 1 }]}>Kg</Text>
        <Text style={[s.label, { color: C.sub, flex: 1 }]}>Reps</Text>
        <View style={{ width: 36 }} />
      </View>

      {rows.map((r, i) => (
        <View key={i} style={s.row}>
          <Text style={[s.setNum, { color: C.text }]}>{i + 1}</Text>
          <TextInput
            style={[...input, { flex: 1 }]}
            value={r.kg}
            onChangeText={t => edit(i, { kg: cleanKg(t) })}
            placeholder="0"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            accessibilityLabel={`Serie ${i + 1}, kilos`}
          />
          <TextInput
            style={[...input, { flex: 1 }]}
            value={r.reps}
            onChangeText={t => edit(i, { reps: cleanReps(t) })}
            placeholder={plannedReps != null ? String(plannedReps) : '0'}
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            accessibilityLabel={`Serie ${i + 1}, repeticiones`}
          />
          {rows.length > 1 ? (
            <TouchableOpacity
              onPress={() => removeSet(i)}
              style={s.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Quitar la serie ${i + 1}`}
            >
              <X size={18} color={C.sub} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[s.addBtn, { borderColor: C.border, opacity: rows.length >= MAX_SETS ? 0.4 : 1 }]}
        onPress={addSet}
        disabled={rows.length >= MAX_SETS}
        accessibilityRole="button"
      >
        <Plus size={16} color={Colors.primary} />
        <Text style={s.addText}>Añadir serie</Text>
      </TouchableOpacity>

      <View style={s.footer}>
        <Text style={[s.status, { color: dirty ? '#B45309' : saved ? Colors.primary : C.sub }]}>
          {dirty ? 'Sin guardar' : saved ? '✓ Guardado' : ''}
        </Text>
        <TouchableOpacity
          style={[s.saveBtn, { opacity: saving || !dirty ? 0.55 : 1 }]}
          onPress={save}
          disabled={saving || !dirty}
          accessibilityRole="button"
          accessibilityLabel={`Guardar las series de ${name}`}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Guardar series</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, gap: 8 },
  head: { gap: 2 },
  name: { fontSize: 15, fontFamily: FBB },
  plan: { fontSize: 12, fontFamily: FB },
  labels: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontFamily: FBB, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setNum: { width: 52, fontSize: 16, fontFamily: FBB, textAlign: 'center' },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 18, fontFamily: FBB, textAlign: 'center', minHeight: 46, minWidth: 0,
  },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, minHeight: 42,
  },
  addText: { color: Colors.primary, fontFamily: FBB, fontSize: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { fontSize: 13, fontFamily: FBB, flexShrink: 1 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: 12, minHeight: 44, minWidth: 140,
    paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  saveText: { color: '#fff', fontFamily: FBB, fontSize: 15 },
});
