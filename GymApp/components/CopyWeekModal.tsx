import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { copyWeek, getUsers } from '../services/api';
import { notify } from '../services/ui';
import { Colors } from '../constants/colors';

// "Copiar semana" (entrenadora): copia las rutinas de una semana de un cliente a otra semana
// y/o a otros clientes, y se puede repetir varias semanas seguidas.

type Client = { id: number; name: string };
type Props = {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  C: { bg: string; surface: string; text: string; sub: string; border: string };
  initialDate: Date;
};

const DAY = 24 * 3600 * 1000;

function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function weekLabel(monday: Date) {
  const f = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return `${f(monday)} – ${f(addDays(monday, 6))}`;
}

export default function CopyWeekModal({ visible, onClose, onDone, C, initialDate }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<number | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const [srcWeek, setSrcWeek] = useState(mondayOf(initialDate));
  const [tgtWeek, setTgtWeek] = useState(addDays(mondayOf(initialDate), 7));
  const [weeks, setWeeks] = useState(1);

  useEffect(() => {
    if (!visible) return;
    const monday = mondayOf(initialDate);
    setSrcWeek(monday);
    setTgtWeek(addDays(monday, 7));
    setWeeks(1);
    setLoading(true);
    getUsers()
      .then((all: any[]) => {
        const list = (all ?? []).filter(u => u.role !== 'admin' && u.status === 'active');
        setClients(list);
        setSource(list[0]?.id ?? null);
        setTargets(list[0] ? [list[0].id] : []);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const toggleTarget = (id: number) =>
    setTargets(t => (t.includes(id) ? t.filter(x => x !== id) : [...t, id]));

  const pickSource = (id: number) => {
    // al cambiar de cliente de origen, el destino por defecto es ese mismo cliente
    setSource(id);
    setTargets([id]);
  };

  const nameOf = (id: number | null) => clients.find(c => c.id === id)?.name ?? '';
  const lastTarget = addDays(tgtWeek, 7 * (weeks - 1));
  const canCopy = !saving && source !== null && targets.length > 0;

  const submit = async () => {
    if (source === null) return;
    setSaving(true);
    try {
      const r = await copyWeek({
        source_user_id: source,
        source_start: iso(srcWeek),
        target_user_ids: targets,
        target_start: iso(tgtWeek),
        weeks,
      });
      notify(
        r.created > 0 ? 'Semana copiada' : 'Nada que copiar',
        r.created > 0
          ? `Se ${r.created === 1 ? 'ha creado 1 rutina' : `han creado ${r.created} rutinas`}${r.skipped ? ` (${r.skipped} ya existían y se han saltado)` : ''}.`
          : 'Todas las rutinas ya estaban asignadas en esas fechas.',
      );
      if (r.created > 0) onDone();
      onClose();
    } catch (e: any) {
      notify('No se pudo copiar', e?.message ?? 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const Stepper = ({ label, monday, onChange }: { label: string; monday: Date; onChange: (d: Date) => void }) => (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: C.sub }]}>{label}</Text>
      <View style={[s.stepper, { borderColor: C.border, backgroundColor: C.bg }]}>
        <TouchableOpacity onPress={() => onChange(addDays(monday, -7))} style={s.stepBtn} accessibilityLabel="Semana anterior">
          <ChevronLeft size={20} color={C.text} />
        </TouchableOpacity>
        <Text style={[s.stepText, { color: C.text }]}>{weekLabel(monday)}</Text>
        <TouchableOpacity onPress={() => onChange(addDays(monday, 7))} style={s.stepBtn} accessibilityLabel="Semana siguiente">
          <ChevronRight size={20} color={C.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[s.chip, { borderColor: on ? Colors.primary : C.border, backgroundColor: on ? Colors.primary : C.bg }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={{ color: on ? '#FFFFFF' : C.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: C.surface }]}>
          <Text style={[s.title, { color: C.text }]}>Copiar semana</Text>

          {loading ? (
            <ActivityIndicator style={{ margin: 24 }} />
          ) : clients.length === 0 ? (
            <Text style={{ color: C.sub, textAlign: 'center', paddingVertical: 24 }}>
              Todavía no hay clientes activos.
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
              <View style={{ gap: 6 }}>
                <Text style={[s.label, { color: C.sub }]}>Copiar las rutinas de</Text>
                <View style={s.chips}>
                  {clients.map(c => (
                    <Chip key={c.id} label={c.name} on={source === c.id} onPress={() => pickSource(c.id)} />
                  ))}
                </View>
              </View>
              <Stepper label="de la semana" monday={srcWeek} onChange={setSrcWeek} />

              <View style={{ gap: 6 }}>
                <Text style={[s.label, { color: C.sub }]}>Pegarlas a (puedes marcar varios)</Text>
                <View style={s.chips}>
                  {clients.map(c => (
                    <Chip key={c.id} label={c.name} on={targets.includes(c.id)} onPress={() => toggleTarget(c.id)} />
                  ))}
                </View>
              </View>
              <Stepper label="en la semana" monday={tgtWeek} onChange={setTgtWeek} />

              <View style={{ gap: 6 }}>
                <Text style={[s.label, { color: C.sub }]}>Repetir</Text>
                <View style={[s.stepper, { borderColor: C.border, backgroundColor: C.bg }]}>
                  <TouchableOpacity onPress={() => setWeeks(w => Math.max(1, w - 1))} style={s.stepBtn} accessibilityLabel="Menos semanas">
                    <Text style={[s.stepSign, { color: C.text }]}>−</Text>
                  </TouchableOpacity>
                  <Text style={[s.stepText, { color: C.text }]}>
                    {weeks} {weeks === 1 ? 'semana' : 'semanas seguidas'}
                  </Text>
                  <TouchableOpacity onPress={() => setWeeks(w => Math.min(12, w + 1))} style={s.stepBtn} accessibilityLabel="Más semanas">
                    <Text style={[s.stepSign, { color: C.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[s.summary, { color: C.sub, backgroundColor: C.bg }]}>
                Se copiará la semana del {weekLabel(srcWeek)} de {nameOf(source)} a{' '}
                {targets.length ? targets.map(nameOf).join(', ') : '(elige al menos un cliente)'}
                {weeks > 1 ? `, desde el ${weekLabel(tgtWeek)} hasta el ${weekLabel(lastTarget)}` : `, en la semana del ${weekLabel(tgtWeek)}`}.
                Lo que ya exista no se duplica y las copias empiezan como pendientes.
              </Text>
            </ScrollView>
          )}

          <View style={s.btns}>
            <TouchableOpacity style={[s.btnCancel, { borderColor: C.border }]} onPress={onClose} disabled={saving}>
              <Text style={{ color: C.sub, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnOk, { opacity: canCopy ? 1 : 0.5 }]}
              onPress={submit}
              disabled={!canCopy}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Copiar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  card: { width: '100%', maxWidth: 560, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, gap: 14 },
  title: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  stepBtn: { padding: 12, minWidth: 48, alignItems: 'center' },
  stepSign: { fontSize: 22, fontWeight: '700' },
  stepText: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  summary: { fontSize: 13, lineHeight: 19, padding: 12, borderRadius: 12 },
  btns: { flexDirection: 'row', gap: 10 },
  btnCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnOk: { flex: 1, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
});
