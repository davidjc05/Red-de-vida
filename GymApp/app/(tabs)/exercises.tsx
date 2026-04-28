import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput,
  StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity, SafeAreaView,
  Modal, ScrollView, Image, Linking, Platform,
} from 'react-native';
import { getExercises, createExercise } from '../../services/api';

// ─── Design tokens (mismo sistema que RoutinesScreen) ────────────────────────

const G = {
  primary:     '#3B6D11',
  primaryDark: '#27500A',
  primaryLt:   '#EAF3DE',
  primaryPale: '#F2F5EE',
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

// ─── Types ───────────────────────────────────────────────────────────────────

type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  description?: string;
  image_url?: string;
  video_url?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── ExerciseCard (definido FUERA del screen para evitar recreación) ──────────

const ExerciseCard = ({ item }: { item: Exercise }) => {
  const gc = GROUP_COLORS[item.muscle_group] ?? GROUP_COLORS.default;

  return (
    <View style={s.card}>
      {/* Imagen o barra de color */}
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={s.cardImage} />
      ) : (
        <View style={[s.cardAccentBar, { backgroundColor: gc.accent }]} />
      )}

      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={[s.badge, { backgroundColor: gc.bg }]}>
            <Text style={[s.badgeText, { color: gc.text }]}>{item.muscle_group}</Text>
          </View>
          {item.video_url && (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.video_url!)}
              style={s.videoBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.videoBtnText}>▶ Ver vídeo</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.cardName}>{item.name}</Text>
        {item.description ? (
          <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>
    </View>
  );
};

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const [exercises, setExercises]   = useState<Exercise[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [filter, setFilter]         = useState('Todos');
  const [search, setSearch]         = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);

  // ── FIX 1: load usa el grupo actual y siempre se llama cuando cambia el filtro
  const load = useCallback(async (group: string = filter) => {
    setLoading(true);
    try {
      const data = await getExercises(group === 'Todos' ? undefined : group);
      setExercises(data);
    } catch (e: any) {
      Alert.alert('Error cargando ejercicios', e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Carga inicial
  useEffect(() => { load('Todos'); }, []);

  // ── FIX 2: cuando cambia el filtro, recargar desde la API
  const handleFilterChange = (group: string) => {
    setFilter(group);
    load(group);
  };

  // ── FIX 3: handleSave corregido — espera la respuesta y recarga
  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      await createExercise({
        name: form.name.trim(),
        muscle_group: form.muscle_group,
        description: form.description.trim() || undefined,
        image_url:   form.image_url.trim()   || undefined,
        video_url:   form.video_url.trim()   || undefined,
      });
      setModalVisible(false);
      setForm(EMPTY_FORM);
      // Recargar con el filtro activo para que aparezca si corresponde
      await load(filter);
    } catch (e: any) {
      Alert.alert('Error al guardar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setForm(EMPTY_FORM);
  };

  // Filtro local de búsqueda (sobre los ya filtrados por grupo desde la API)
  const displayed = exercises.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.container}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerEyebrow}>CATÁLOGO</Text>
            <Text style={s.headerTitle}>Ejercicios</Text>
            <Text style={s.headerSub}>{exercises.length} disponibles</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={s.addBtnText}>+ CREAR</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <TextInput
          style={s.searchInput}
          placeholder="Buscar ejercicio..."
          placeholderTextColor={G.textHint}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* ── Chips de filtro ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsRow}
        style={s.chipsContainer}
      >
        {MUSCLE_GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[s.chip, filter === g && s.chipActive]}
            onPress={() => handleFilterChange(g)}
          >
            <Text style={[s.chipText, filter === g && s.chipTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Lista ── */}
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
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          renderItem={({ item }) => <ExerciseCard item={item} />}
        />
      )}

      {/* ── Modal creación ── */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Barra de acento */}
            <View style={s.modalAccentBar} />

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Nuevo ejercicio</Text>
                <TouchableOpacity onPress={handleCloseModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 20, color: G.textHint }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Nombre */}
              <Text style={s.inputLabel}>Nombre *</Text>
              <TextInput
                style={s.input}
                placeholder="Ej: Press de banca"
                placeholderTextColor={G.textHint}
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                autoFocus
              />

              {/* Grupo muscular */}
              <Text style={s.inputLabel}>Grupo muscular</Text>
              <View style={s.modalChips}>
                {MUSCLE_GROUPS.filter((g) => g !== 'Todos').map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[s.modalChip, form.muscle_group === g && s.modalChipActive]}
                    onPress={() => setForm({ ...form, muscle_group: g })}
                  >
                    <Text style={[s.modalChipText, form.muscle_group === g && s.modalChipTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Descripción */}
              <Text style={s.inputLabel}>Descripción (opcional)</Text>
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Explica la ejecución del ejercicio..."
                placeholderTextColor={G.textHint}
                multiline
                numberOfLines={3}
                value={form.description}
                onChangeText={(t) => setForm({ ...form, description: t })}
              />

              {/* URL Imagen */}
              <Text style={s.inputLabel}>URL imagen (opcional)</Text>
              <TextInput
                style={s.input}
                placeholder="https://..."
                placeholderTextColor={G.textHint}
                value={form.image_url}
                onChangeText={(t) => setForm({ ...form, image_url: t })}
                keyboardType="url"
                autoCapitalize="none"
              />

              {/* URL Vídeo */}
              <Text style={s.inputLabel}>URL vídeo / YouTube (opcional)</Text>
              <TextInput
                style={s.input}
                placeholder="https://youtube.com/..."
                placeholderTextColor={G.textHint}
                value={form.video_url}
                onChangeText={(t) => setForm({ ...form, video_url: t })}
                keyboardType="url"
                autoCapitalize="none"
              />

              {/* Acciones */}
              <View style={s.modalActions}>
                <TouchableOpacity style={s.btnCancel} onPress={handleCloseModal}>
                  <Text style={s.btnCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btnSave, { opacity: saving ? 0.6 : 1 }]}
                  onPress={handleSave}
                  disabled={saving}
                >
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bgPage },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 10 },
  loadingText: { color: G.textSub, fontFamily: FB, fontSize: 14, marginTop: 8 },
  emptyTitle: { fontSize: 20, fontFamily: FC, color: G.textMain, textAlign: 'center' },
  emptySub: { fontSize: 13, fontFamily: FB, color: G.textHint, textAlign: 'center', lineHeight: 18 },

  // Header
  header: {
    backgroundColor: G.white, paddingHorizontal: 20,
    paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: G.border,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerEyebrow: { fontSize: 10, fontFamily: FBB, letterSpacing: 2, color: G.textHint, marginBottom: 4 },
  headerTitle: { fontSize: 36, fontFamily: FC, color: G.textMain, lineHeight: 38, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: FB, color: G.textHint, marginTop: 3 },
  addBtn: { backgroundColor: G.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, marginTop: 4 },
  addBtnText: { fontSize: 14, fontFamily: FC, color: G.white, letterSpacing: 0.5 },
  searchInput: {
    backgroundColor: G.bgPage, borderWidth: 0.5, borderColor: G.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: FB, color: G.textMain,
  },

  // Chips
  chipsContainer: { backgroundColor: G.white, borderBottomWidth: 0.5, borderBottomColor: G.border, flexGrow: 0 },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: G.border, backgroundColor: G.bgPage,
  },
  chipActive: { backgroundColor: G.primary, borderColor: G.primary },
  chipText: { fontSize: 12, fontFamily: FBB, color: G.textHint },
  chipTextActive: { color: G.white },

  // List
  list: { padding: 16, gap: 12, paddingBottom: 40 },

  // Exercise card
  card: {
    backgroundColor: G.white, borderRadius: 16,
    borderWidth: 0.5, borderColor: G.border, overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 160, resizeMode: 'cover' },
  cardAccentBar: { height: 4 },
  cardInner: { padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: FBB },
  videoBtn: { backgroundColor: G.primaryLt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  videoBtnText: { fontSize: 11, fontFamily: FBB, color: G.primary },
  cardName: { fontSize: 18, fontFamily: FC, color: G.textMain, letterSpacing: -0.2, marginBottom: 5 },
  cardDesc: { fontSize: 13, fontFamily: FB, color: G.textSub, lineHeight: 18 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: G.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 44, maxHeight: '88%', overflow: 'hidden',
  },
  modalAccentBar: { height: 4, backgroundColor: G.primary, marginBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontFamily: FC, color: G.textMain },
  inputLabel: { fontSize: 12, fontFamily: FBB, color: G.textHint, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: G.bgPage, borderWidth: 0.5, borderColor: G.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: FB, color: G.textMain, marginBottom: 16,
  },
  inputMultiline: { height: 88, textAlignVertical: 'top' },

  // Modal chips (grupos musculares)
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  modalChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: G.border, backgroundColor: G.bgPage,
  },
  modalChipActive: { backgroundColor: G.primary, borderColor: G.primary },
  modalChipText: { fontSize: 12, fontFamily: FBB, color: G.textSub },
  modalChipTextActive: { color: G.white },

  // Buttons
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, marginBottom: 8 },
  btnCancel: { paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, borderWidth: 0.5, borderColor: G.border },
  btnCancelText: { fontSize: 14, fontFamily: FB, color: G.textMain },
  btnSave: {
    flex: 1, backgroundColor: G.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  btnSaveText: { color: G.white, fontSize: 14, fontFamily: FC, letterSpacing: 0.5 },
});