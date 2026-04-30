import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput,
  StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity, SafeAreaView,
  Modal, ScrollView, Image, Linking,Platform,
} from 'react-native';
import { getExercises, createExercise, getRole } from '../../services/api';

const G = {
  primary:     '#3B6D11',
  primaryDark: '#27500A',
  primaryLt:   '#EAF3DE',
  white:       '#FFFFFF',
  bgPage:      '#F2F5EE',
  border:      '#D3D1C7',
  textMain:    '#1A1A1A',
  textSub:     '#5F5E5A',
  textHint:    '#888780',
  danger:      '#E24B4A',
};

const FC  = 'BarlowCondensed-ExtraBold';
const FB  = 'Barlow-Regular';
const FBB = 'Barlow-Bold';

type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  description?: string;
  image_url?: string;
  video_url?: string;
};

const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core'];

const GROUP_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Pecho:   { bg: '#EAF3DE', text: '#27500A', accent: '#3B6D11' },
  Espalda: { bg: '#EEF2FF', text: '#3730A3', accent: '#6366F1' },
  Piernas: { bg: '#FEF3C7', text: '#92400E', accent: '#F59E0B' },
  Hombros: { bg: '#FCE7F3', text: '#9D174D', accent: '#EC4899' },
  Bíceps:  { bg: '#E0F2FE', text: '#075985', accent: '#0EA5E9' },
  Tríceps: { bg: '#F0FDF4', text: '#14532D', accent: '#22C55E' },
  Core:    { bg: '#FFF7ED', text: '#9A3412', accent: '#F97316' },
  default: { bg: '#F1F5F9', text: '#475569', accent: '#94A3B8' },
};

const EMPTY_FORM = {
  name: '', muscle_group: 'Pecho', description: '', image_url: '', video_url: '',
};

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  item: Exercise;
  isAdmin: boolean;
  onView: (item: Exercise) => void;
  onEdit: (item: Exercise) => void;
  onDelete: (item: Exercise) => void;
}

const ExerciseCard = ({ item, isAdmin, onView, onEdit, onDelete }: ExerciseCardProps) => {
  const gc = GROUP_COLORS[item.muscle_group] ?? GROUP_COLORS.default;

  return (
    <View style={s.card}>

      {/* ZONA CLICABLE (editar/ver) */}
      <TouchableOpacity
        style={{ flex: 1 }}
        onPress={() => isAdmin ? onEdit(item) : onView(item)}
        onLongPress={() => onView(item)}
        activeOpacity={0.75}
      >
        <View style={[s.cardStripe, { backgroundColor: gc.accent }]} />

        <View style={s.cardBody}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={s.cardThumb} />
          ) : (
            <View style={[s.cardThumbPlaceholder, { backgroundColor: gc.bg }]}>
            </View>
          )}

          <View style={s.cardInfo}>
            <Text style={s.cardName} numberOfLines={1}>
              {item.name}
            </Text>

            <View style={[s.badge, { backgroundColor: gc.bg }]}>
              <Text style={[s.badgeText, { color: gc.text }]}>
                {item.muscle_group}
              </Text>
            </View>

            {item.description ? (
              <Text style={s.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : (
              <Text style={s.cardDescEmpty}>Sin descripción</Text>
            )}
          </View>

        </View>
      </TouchableOpacity>

      {/* BOTÓN DELETE SEPARADO */}
      {isAdmin && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            padding: 6,
            zIndex: 10,
          }}
          onPress={() => onDelete(item)}
        >
          <Text style={{ color: G.danger, fontSize: 25 }}>🗑️</Text>
        </TouchableOpacity>
      )}

    </View>
  );
};

// ─── DetailModal ──────────────────────────────────────────────────────────────

interface DetailModalProps {
  exercise: Exercise | null;
  onClose: () => void;
}

const ExerciseDetailModal = ({ exercise, onClose }: DetailModalProps) => {
  if (!exercise) return null;
  const gc = GROUP_COLORS[exercise.muscle_group] ?? GROUP_COLORS.default;
  return (
    <Modal visible={!!exercise} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={s.detailSafeArea}>
        <View style={s.detailTopBar}>
          <View style={[s.badge, { backgroundColor: gc.bg }]}>
            <Text style={[s.badgeText, { color: gc.text }]}>{exercise.muscle_group}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.detailCloseBtn}>
            <Text style={s.detailCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces>
          <View style={s.detailContent}>
            <View style={[s.detailNameAccent, { backgroundColor: gc.accent }]} />
            <Text style={s.detailName}>{exercise.name}</Text>
            {exercise.description ? (
              <View style={s.detailDescBlock}>
                <Text style={s.detailSectionLabel}>DESCRIPCIÓN</Text>
                <Text style={s.detailDescription}>{exercise.description}</Text>
              </View>
            ) : (
              <View style={s.detailNoDesc}>
                <Text style={s.detailNoDescTxt}>Sin descripción disponible</Text>
              </View>
            )}
            {exercise.video_url && (
              <TouchableOpacity style={s.videoButton} onPress={() => Linking.openURL(exercise.video_url!)} activeOpacity={0.8}>
                <View style={s.videoButtonIcon}><Text style={{ color: G.white, fontSize: 16 }}>▶</Text></View>
                <Text style={s.videoButtonText}>Ver vídeo del ejercicio</Text>
              </TouchableOpacity>
            )}
            {exercise.image_url ? (
              <Image source={{ uri: exercise.image_url }} style={s.detailImage} resizeMode="contain" />
            ) : (
              <View style={[s.detailImagePlaceholder, { backgroundColor: gc.bg }]}>
                <Text style={{ fontSize: 64 }}>💪</Text>
              </View>
            )}
            <TouchableOpacity style={s.detailCloseFull} onPress={onClose}>
              <Text style={s.detailCloseFullTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─── EditModal (admin) ────────────────────────────────────────────────────────

interface EditModalProps {
  exercise: Exercise | null;
  onClose: () => void;
  onSaved: () => void;
}

const ExerciseEditModal = ({ exercise, onClose, onSaved }: EditModalProps) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exercise) {
      setForm({
        name:         exercise.name,
        muscle_group: exercise.muscle_group,
        description:  exercise.description  ?? '',
        image_url:    exercise.image_url    ?? '',
        video_url:    exercise.video_url    ?? '',
      });
    }
  }, [exercise]);

  if (!exercise) return null;

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      // PATCH /exercises/{id}
      const { API_URL, getToken } = require('../../services/api');
      const token = await getToken();
      const res = await fetch(`${API_URL}/exercises/${exercise.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name:         form.name.trim(),
          muscle_group: form.muscle_group,
          description:  form.description.trim() || null,
          image_url:    form.image_url.trim()   || null,
          video_url:    form.video_url.trim()   || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Error al guardar');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!exercise} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={[s.modalAccentBar, { backgroundColor: '#F59E0B' }]} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Editar ejercicio</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                <Text style={{ fontSize: 20, color: G.textHint }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Nombre *</Text>
            <TextInput style={s.input} placeholder="Ej: Press de banca" placeholderTextColor={G.textHint}
              value={form.name} onChangeText={t => setForm({ ...form, name: t })} autoFocus />

            <Text style={s.inputLabel}>Grupo muscular</Text>
            <View style={s.modalChips}>
              {MUSCLE_GROUPS.filter(g => g !== 'Todos').map(g => (
                <TouchableOpacity key={g}
                  style={[s.modalChip, form.muscle_group === g && s.modalChipActive]}
                  onPress={() => setForm({ ...form, muscle_group: g })}>
                  <Text style={[s.modalChipText, form.muscle_group === g && s.modalChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inputLabel}>Descripción (opcional)</Text>
            <TextInput style={[s.input, s.inputMultiline]} placeholder="Explica la ejecución..."
              placeholderTextColor={G.textHint} multiline numberOfLines={3}
              value={form.description} onChangeText={t => setForm({ ...form, description: t })} />

            <Text style={s.inputLabel}>URL imagen (opcional)</Text>
            <TextInput style={s.input} placeholder="https://..." placeholderTextColor={G.textHint}
              value={form.image_url} onChangeText={t => setForm({ ...form, image_url: t })}
              keyboardType="url" autoCapitalize="none" />

            <Text style={s.inputLabel}>URL vídeo / YouTube (opcional)</Text>
            <TextInput style={s.input} placeholder="https://youtube.com/..." placeholderTextColor={G.textHint}
              value={form.video_url} onChangeText={t => setForm({ ...form, video_url: t })}
              keyboardType="url" autoCapitalize="none" />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnCancel} onPress={onClose}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSave, { opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={G.white} />
                  : <Text style={s.btnSaveText}>GUARDAR CAMBIOS</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const [exercises, setExercises]         = useState<Exercise[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [filter, setFilter]               = useState('Todos');
  const [search, setSearch]               = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [editExercise, setEditExercise]   = useState<Exercise | null>(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [isAdmin, setIsAdmin]             = useState<boolean | null>(null);

  const load = useCallback(async (group: string) => {
    setLoading(true);
    try {
      const data = await getExercises(group === 'Todos' ? undefined : group);
      setExercises(data);
    } catch (e: any) {
      Alert.alert('Error cargando ejercicios', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('Todos');
    getRole().then(role => {
      console.log("ROLE RAW:", role);
      setIsAdmin(role?.toLowerCase().trim() === 'admin');
    });
  }, []);

  const handleFilterChange = (group: string) => { setFilter(group); load(group); };

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      await createExercise({
        name:         form.name.trim(),
        muscle_group: form.muscle_group,
        description:  form.description.trim() || undefined,
        image_url:    form.image_url.trim()   || undefined,
        video_url:    form.video_url.trim()   || undefined,
      });
      setCreateVisible(false);
      setForm(EMPTY_FORM);
      await load(filter);
    } catch (e: any) {
      Alert.alert('Error al guardar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exercise: Exercise) => {
    console.log("PULSADO BORRAR:", exercise.id);

    const confirmar =
      Platform.OS === 'web'
        ? window.confirm(`¿Seguro que quieres eliminar "${exercise.name}"?`)
        : true;

    if (!confirmar) return;

    const borrar = async () => {
      try {
        const { API_URL, getToken } = require('../../services/api');
        const token = await getToken();

        console.log("TOKEN DELETE:", token);

        const res = await fetch(`${API_URL}/exercises/${exercise.id}`, {
          method: 'DELETE',
          headers: {
            'ngrok-skip-browser-warning': 'true',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const text = await res.text();

        console.log("DELETE STATUS:", res.status);
        console.log("DELETE RESPONSE:", text);

        if (!res.ok) {
          throw new Error(text || "Error al eliminar");
        }

        await load(filter);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      }
    };

    if (Platform.OS === 'web') {
      await borrar();
    } else {
      Alert.alert(
        "Eliminar ejercicio",
        `¿Seguro que quieres eliminar "${exercise.name}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: borrar,
          },
        ]
      );
    }
  };

  const displayed = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  if (isAdmin === null) return <View style={s.center}><ActivityIndicator size="large" color={G.primary} /></View>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerEyebrow}>CATÁLOGO</Text>
            <Text style={s.headerTitle}>Ejercicios</Text>
            <Text style={s.headerSub}>{exercises.length} disponibles</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={s.addBtn} onPress={() => setCreateVisible(true)}>
              <Text style={s.addBtnText}>+ CREAR</Text>
            </TouchableOpacity>
          )}
        </View>
        <TextInput style={s.searchInput} placeholder="Buscar ejercicio..." placeholderTextColor={G.textHint}
          value={search} onChangeText={setSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow} style={s.chipsContainer}>
        {MUSCLE_GROUPS.map(g => (
          <TouchableOpacity key={g} style={[s.chip, filter === g && s.chipActive]} onPress={() => handleFilterChange(g)}>
            <Text style={[s.chipText, filter === g && s.chipTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isAdmin && (
        <View style={s.adminHint}>
          <Text style={s.adminHintText}>✎ Toca una tarjeta para editarla · Mantén pulsado para ver detalle</Text>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={G.primary} />
          <Text style={s.loadingText}>Cargando ejercicios...</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={s.emptyTitle}>Sin resultados</Text>
          <Text style={s.emptySub}>Prueba otro filtro o crea un ejercicio nuevo</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <ExerciseCard
              item={item}
              isAdmin={!!isAdmin}
              onView={setDetailExercise}
              onEdit={setEditExercise}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {/* Modal detalle (todos) */}
      <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />

      {/* Modal edición (solo admin) */}
      <ExerciseEditModal
        exercise={editExercise}
        onClose={() => setEditExercise(null)}
        onSaved={() => load(filter)}
      />

      {/* Modal creación (solo admin) */}
      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => { setCreateVisible(false); setForm(EMPTY_FORM); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalAccentBar} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Nuevo ejercicio</Text>
                <TouchableOpacity onPress={() => { setCreateVisible(false); setForm(EMPTY_FORM); }} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                  <Text style={{ fontSize: 20, color: G.textHint }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.inputLabel}>Nombre *</Text>
              <TextInput style={s.input} placeholder="Ej: Press de banca" placeholderTextColor={G.textHint}
                value={form.name} onChangeText={t => setForm({ ...form, name: t })} autoFocus />

              <Text style={s.inputLabel}>Grupo muscular</Text>
              <View style={s.modalChips}>
                {MUSCLE_GROUPS.filter(g => g !== 'Todos').map(g => (
                  <TouchableOpacity key={g}
                    style={[s.modalChip, form.muscle_group === g && s.modalChipActive]}
                    onPress={() => setForm({ ...form, muscle_group: g })}>
                    <Text style={[s.modalChipText, form.muscle_group === g && s.modalChipTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.inputLabel}>Descripción (opcional)</Text>
              <TextInput style={[s.input, s.inputMultiline]} placeholder="Explica la ejecución del ejercicio..."
                placeholderTextColor={G.textHint} multiline numberOfLines={3}
                value={form.description} onChangeText={t => setForm({ ...form, description: t })} />

              <Text style={s.inputLabel}>URL imagen (opcional)</Text>
              <TextInput style={s.input} placeholder="https://..." placeholderTextColor={G.textHint}
                value={form.image_url} onChangeText={t => setForm({ ...form, image_url: t })}
                keyboardType="url" autoCapitalize="none" />

              <Text style={s.inputLabel}>URL vídeo / YouTube (opcional)</Text>
              <TextInput style={s.input} placeholder="https://youtube.com/..." placeholderTextColor={G.textHint}
                value={form.video_url} onChangeText={t => setForm({ ...form, video_url: t })}
                keyboardType="url" autoCapitalize="none" />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.btnCancel} onPress={() => { setCreateVisible(false); setForm(EMPTY_FORM); }}>
                  <Text style={s.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnSave, { opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator size="small" color={G.white} />
                    : <Text style={s.btnSaveText}>GUARDAR EJERCICIO</Text>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bgPage },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 10 },
  loadingText: { color: G.textSub, fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 20, color: G.textMain, textAlign: 'center' },
  emptySub: { fontSize: 13, color: G.textHint, textAlign: 'center', lineHeight: 18 },
  adminHint: { backgroundColor: '#FEF9C3', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#FDE68A' },
  adminHintText: { fontSize: 12, color: '#92400E', textAlign: 'center' },
  header: { backgroundColor: G.white, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: G.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerEyebrow: { fontSize: 10, letterSpacing: 2, color: G.textHint, marginBottom: 4 },
  headerTitle: { fontSize: 36, color: G.textMain, lineHeight: 38, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: G.textHint, marginTop: 3 },
  addBtn: { backgroundColor: G.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, marginTop: 4 },
  addBtnText: { fontSize: 14, color: G.white, letterSpacing: 0.5 },
  searchInput: { backgroundColor: G.bgPage, borderWidth: 0.5, borderColor: G.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: G.textMain },
  chipsContainer: { backgroundColor: G.white, borderBottomWidth: 0.5, borderBottomColor: G.border, flexGrow: 0 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: G.border, backgroundColor: G.bgPage },
  chipActive: { backgroundColor: G.primary, borderColor: G.primary },
  chipText: { fontSize: 12, color: G.textHint },
  chipTextActive: { color: G.white },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { backgroundColor: G.white, borderRadius: 14, borderWidth: 0.5, borderColor: G.border, flexDirection: 'row', overflow: 'hidden' },
  cardStripe: { width: 4 },
  cardBody: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  cardThumb: { width: 56, height: 56, borderRadius: 10 },
  cardThumbPlaceholder: { width: 56, height: 56, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, color: G.textMain },
  cardDesc: { fontSize: 12, color: G.textHint, lineHeight: 16 },
  cardDescEmpty: { fontSize: 12, color: G.border, fontStyle: 'italic' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  badgeText: { fontSize: 10 },
  cardMeta: { alignItems: 'center', gap: 4 },
  metaIcon: { fontSize: 12 },
  cardArrow: { fontSize: 22, color: G.border, lineHeight: 24 },
  detailSafeArea: { flex: 1, backgroundColor: G.white },
  detailTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: G.border, backgroundColor: G.white },
  detailImage: { width: '100%', aspectRatio: 4/3, borderRadius: 14, marginTop: 20 },
  detailImagePlaceholder: { width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' },
  detailContent: { padding: 24, paddingBottom: 48 },
  detailNameAccent: { width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  detailName: { fontSize: 32, color: G.textMain, letterSpacing: -0.5, lineHeight: 34, marginBottom: 20 },
  detailCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: G.bgPage, borderWidth: 0.5, borderColor: G.border, justifyContent: 'center', alignItems: 'center' },
  detailCloseTxt: { fontSize: 14, color: G.textHint },
  detailDescBlock: { marginBottom: 8 },
  detailSectionLabel: { fontSize: 10, letterSpacing: 1.5, color: G.textHint, marginBottom: 10 },
  detailDescription: { fontSize: 15, color: G.textSub, lineHeight: 26 },
  detailNoDesc: { backgroundColor: G.bgPage, borderRadius: 10, padding: 14, borderWidth: 0.5, borderColor: G.border, marginBottom: 8 },
  detailNoDescTxt: { fontSize: 13, color: G.textHint, textAlign: 'center' },
  videoButton: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: G.primary, borderRadius: 14, padding: 16, marginTop: 24 },
  videoButtonIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: G.primaryDark, justifyContent: 'center', alignItems: 'center' },
  videoButtonText: { fontSize: 15, color: G.white, flex: 1 },
  detailCloseFull: { marginTop: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 0.5, borderColor: G.border, alignItems: 'center' },
  detailCloseFullTxt: { fontSize: 14, color: G.textSub },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: G.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 44, maxHeight: '88%', overflow: 'hidden' },
  modalAccentBar: { height: 4, backgroundColor: G.primary, marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, color: G.textMain },
  inputLabel: { fontSize: 11, color: G.textHint, letterSpacing: 0.8, marginBottom: 8, marginTop: 2 },
  input: { backgroundColor: G.bgPage, borderWidth: 0.5, borderColor: G.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: G.textMain, marginBottom: 16 },
  inputMultiline: { height: 88, textAlignVertical: 'top' },
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  modalChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: G.border, backgroundColor: G.bgPage },
  modalChipActive: { backgroundColor: G.primary, borderColor: G.primary },
  modalChipText: { fontSize: 12, color: G.textSub },
  modalChipTextActive: { color: G.white },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, marginBottom: 8 },
  btnCancel: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, borderWidth: 0.5, borderColor: G.border },
  btnCancelText: { fontSize: 14, color: G.textMain },
  btnSave: { flex: 1, backgroundColor: G.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnSaveText: { color: G.white, fontSize: 14, letterSpacing: 0.5 },
});