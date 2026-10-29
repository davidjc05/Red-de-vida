import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, Dimensions, TextInput, Modal,
  FlatList, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, Search, X, ChevronLeft, ChevronRight, ChevronDown, Check,
  UserPlus, CalendarDays, Pencil, Trash2, LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import {
  getExercises, createRoutine, assignRoutine, getUsers, deleteToken, deleteRoutine,
  getAssignmentsByRoutine, deleteAssignment, getToken, updateRoutineFull
} from '../../services/api';
import { useRoutines, type Routine, type Exercise } from '../../hooks/useRoutines';

// Mismas fuentes que calendario y perfil
const FC  = 'BarlowCondensed-ExtraBold';
const FB  = 'Barlow-Regular';
const FBB = 'Barlow-Bold';

// ─── Tipos builder ─────────────────────────────────────────────────────────────
type BlockExercise = {
  localId: string; exerciseId: number; name: string;
  muscle_group: string; series: string; objetivo: string; descanso: string;
};
type Block = { localId: string; name: string; color: string; collapsed: boolean; exercises: BlockExercise[] };
type User = { id: number; name: string; email: string; role: string };

const { width } = Dimensions.get('window');
const isTablet = width > 768;
// Un solo tono (el de la marca) en distintas intensidades: el color no distingue bloques, lo hace el nombre
const BLOCK_COLORS = ['#3B6D11', '#5A9E1A', '#2F5A0D', '#6FA82A', '#4A8514', '#86B84A'];
const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core'];
const uid = () => Date.now().toString() + Math.random().toString(36).slice(2, 6);

// ─── Componente principal ──────────────────────────────────────────────────────
export default function RoutinesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { routines, loading, reload } = useRoutines();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [mode, setMode] = useState<'list' | 'builder'>('list');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Builder state
  const [routineName, setRoutineName] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [builderTab, setBuilderTab] = useState<'bloques' | 'libreria'>('bloques');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('Todos');
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingRoutineName, setPendingRoutineName] = useState('');

  // Modal asignar
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [assignDate, setAssignDate] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
  const [routineAssignments, setRoutineAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);

  // Misma paleta que calendario y perfil
  const C = {
    bg:      isDark ? '#111111' : '#F2F5EE',
    surface: isDark ? '#1A1A1A' : '#FFFFFF',
    card:    isDark ? '#1A1A1A' : '#FFFFFF',
    text:    isDark ? '#F2F2F0' : '#1A1A1A',
    textSub: isDark ? '#A1A1A0' : '#5F5E5A',
    border:  isDark ? '#2A2A2A' : '#E3E6DD',
    error:   isDark ? '#E5566F' : '#C4242A',
  };
  // Fondo suave para lo seleccionado
  const tint = isDark ? Colors.primary + '33' : Colors.primaryLight;

  useEffect(() => {
    getExercises().then(setExercises).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedBlockId && !blocks.find(b => b.localId === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [blocks]);

  // ─── Builder helpers ──────────────────────────────────────────────────────────
  const openBuilder = () => {
    setPendingRoutineName('');
    setShowNameModal(true);
  };

  const confirmNameAndOpenBuilder = () => {
    if (!pendingRoutineName.trim()) {
      Alert.alert('Error', 'Escribe un nombre para la rutina');
      return;
    }
    setRoutineName(pendingRoutineName.trim());
    setBlocks([]);
    setSelectedBlockId(null);
    setBuilderTab('bloques');
    setEditingRoutineId(null);
    setShowNameModal(false);
    setMode('builder');
  };

  const openEditRoutine = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name);

    const mappedBlocks: Block[] = (routine.blocks ?? []).map((b: NonNullable<Routine['blocks']>[0], i: number) => ({
      localId: uid(),
      name: b.name,
      color: BLOCK_COLORS[i % BLOCK_COLORS.length],
      collapsed: false,
      exercises: (b.exercises ?? []).map(ex => ({
        localId: uid(),
        exerciseId: ex.exercise.id,
        name: ex.exercise.name,
        muscle_group: ex.exercise.muscle_group,
        series: String(ex.sets ?? 3),
        objetivo: `${ex.reps ?? 10} reps`,
        descanso: '60s',
      }))
    }));

    setBlocks(mappedBlocks);
    setSelectedBlockId(mappedBlocks[0]?.localId ?? null);
    setBuilderTab('bloques');
    setMode('builder');
  };

  const addBlock = useCallback(() => {
    setBlocks(prev => {
      const color = BLOCK_COLORS[prev.length % BLOCK_COLORS.length];
      const nb: Block = { localId: uid(), name: `Bloque ${prev.length + 1}`, color, collapsed: false, exercises: [] };
      setSelectedBlockId(nb.localId);
      return [...prev, nb];
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(p => p.filter(b => b.localId !== id));
  }, []);

  const toggleCollapse = (id: string) => setBlocks(p => p.map(b => b.localId === id ? { ...b, collapsed: !b.collapsed } : b));
  const updateBlockName = (id: string, v: string) => setBlocks(p => p.map(b => b.localId === id ? { ...b, name: v } : b));

  const addFromLibrary = useCallback((ex: Exercise) => {
    if (!selectedBlockId) { Alert.alert('Selecciona un bloque', 'Primero crea o selecciona un bloque.'); return; }
    setBlocks(prev => prev.map(b => {
      if (b.localId !== selectedBlockId) return b;
      if (b.exercises.some(e => e.exerciseId === ex.id)) { Alert.alert('Ya añadido', 'Este ejercicio ya está en el bloque.'); return b; }
      const newEx: BlockExercise = { localId: uid(), exerciseId: ex.id, name: ex.name, muscle_group: ex.muscle_group, series: '3', objetivo: '10 reps', descanso: '60s' };
      return { ...b, collapsed: false, exercises: [...b.exercises, newEx] };
    }));
  }, [selectedBlockId]);

  const updateExercise = (bId: string, eId: string, field: keyof BlockExercise, v: string) =>
    setBlocks(p => p.map(b => b.localId === bId ? { ...b, exercises: b.exercises.map(e => e.localId === eId ? { ...e, [field]: v } : e) } : b));

  const removeExercise = (bId: string, eId: string) =>
    setBlocks(p => p.map(b => b.localId === bId ? { ...b, exercises: b.exercises.filter(e => e.localId !== eId) } : b));

  // ─── Guardar rutina ───────────────────────────────────────────────────────────
  const saveRoutine = async () => {
    if (!routineName.trim()) { Alert.alert('Error', 'La rutina necesita un nombre'); return; }
    if (blocks.length === 0) { Alert.alert('Error', 'Añade al menos un bloque'); return; }

    setSaving(true);
    try {
      const payload = {
        name: routineName.trim(),
        blocks: blocks.map((b, blockIndex) => ({
          name: b.name,
          order: blockIndex,
          exercises: b.exercises.map((e, exIndex) => ({
            exerciseId: e.exerciseId,
            order: exIndex
          }))
        }))
      };
      if (editingRoutineId) {
        await updateRoutineFull(editingRoutineId, payload.name, payload.blocks);
        Alert.alert('Rutina actualizada');
      } else {
        const routine = await createRoutine(payload.name);
        await updateRoutineFull(routine.id, payload.name, payload.blocks);
        Alert.alert('Rutina creada');
      }
      await reload();
      setMode('list');
      setEditingRoutineId(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Asignar ──────────────────────────────────────────────────────────────────
  const openAssignModal = (routine: Routine) => {
    setSelectedRoutine(routine);
    setSelectedUserIds([]);
    setAssignDate('');
    setAssignNote('');
    setShowAssignModal(true);
  };

  const confirmAssign = async () => {
    if (!selectedRoutine || selectedUserIds.length === 0 || !assignDate) { Alert.alert('Faltan datos'); return; }
    const formattedDate = new Date(assignDate).toISOString().split('T')[0];
    setAssigning(true);
    try {
      await assignRoutine(selectedRoutine.id, selectedUserIds, formattedDate, assignNote || undefined);
      setShowAssignModal(false);
      Alert.alert('Asignadas correctamente');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAssigning(false);
    }
  };

  const openAssignmentsModal = async (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowAssignmentsModal(true);
    setLoadingAssignments(true);
    try {
      const data = await getAssignmentsByRoutine(routine.id);
      setRoutineAssignments(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    try {
      await deleteAssignment(id);
      setRoutineAssignments(prev => prev.filter(a => a.id !== id));
      Alert.alert('Eliminada');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ─── Borrar rutina ────────────────────────────────────────────────────────────
  // window.confirm no existe en iOS/Android: en nativo se usa Alert, en web se mantiene el confirm
  const handleDeleteRoutine = (routine: Routine) => {
    const doDelete = () =>
      deleteRoutine(routine.id)
        .then(() => reload())
        .then(() => (Platform.OS === 'web' ? window.alert('Eliminada') : Alert.alert('Eliminada')))
        .catch((err: any) =>
          Platform.OS === 'web' ? window.alert('Error: ' + err.message) : Alert.alert('Error', err.message)
        );

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar "${routine.name}"?`)) doDelete();
      return;
    }
    Alert.alert('Eliminar rutina', `¿Eliminar "${routine.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doDelete },
    ]);
  };

  // ─── Derivados ────────────────────────────────────────────────────────────────
  const filteredRoutines = routines.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredLibrary = exercises.filter(e => {
    const ms = e.name.toLowerCase().includes(librarySearch.toLowerCase());
    const mg = libraryFilter === 'Todos' || e.muscle_group === libraryFilter;
    return ms && mg;
  });
  const selectedBlock = blocks.find(b => b.localId === selectedBlockId) ?? null;
  const totalExercises = blocks.reduce((s, b) => s + b.exercises.length, 0);
  const canAssign = selectedUserIds.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(assignDate) && !assigning;

  // ─── Stats de la cabecera ─────────────────────────────────────────────────────
  const totalExercisesInRoutines = routines.reduce((sum, r) => {
    return sum + (r.blocks ?? []).flatMap(b => b.exercises ?? []).length;
  }, 0);

  // ─── Panel Bloques ────────────────────────────────────────────────────────────
  const BlocksPanel = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.panelContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {blocks.length === 0 ? (
        <View style={[s.emptyCard, { borderColor: C.border }]}>
          <Text style={[s.emptyTitle, { color: C.text }]}>Sin bloques todavía</Text>
          <Text style={[s.emptySub, { color: C.textSub }]}>
            Crea tu primer bloque, por ejemplo Calentamiento o Fuerza
          </Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={addBlock} activeOpacity={0.85}>
            <Plus size={18} color="#fff" />
            <Text style={s.emptyAddText}>Añadir primer bloque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {blocks.map(block => {
            const isSelected = selectedBlockId === block.localId;
            return (
              <View
                key={block.localId}
                style={[
                  s.blockCard,
                  { backgroundColor: C.surface, borderColor: isSelected ? Colors.primary : C.border },
                ]}
              >
                <TouchableOpacity
                  onPress={() => { setSelectedBlockId(block.localId); toggleCollapse(block.localId); }}
                  style={s.blockHead}
                  activeOpacity={0.7}
                >
                  <View style={[s.blockDot, { backgroundColor: block.color }]} />
                  <TextInput
                    style={[s.blockNameInput, { color: C.text }]}
                    value={block.name}
                    onChangeText={v => updateBlockName(block.localId, v)}
                    onFocus={() => setSelectedBlockId(block.localId)}
                    accessibilityLabel="Nombre del bloque"
                  />
                  <View style={[s.blockCountBadge, { backgroundColor: C.bg }]}>
                    <Text style={[s.blockCountText, { color: C.textSub }]}>{block.exercises.length}</Text>
                  </View>
                  {block.collapsed
                    ? <ChevronRight size={18} color={C.textSub} />
                    : <ChevronDown size={18} color={C.textSub} />}
                  <TouchableOpacity
                    onPress={() => removeBlock(block.localId)}
                    style={s.iconBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel="Eliminar bloque"
                  >
                    <X size={18} color={C.error} />
                  </TouchableOpacity>
                </TouchableOpacity>

                {!block.collapsed && (
                  <>
                    {block.exercises.length === 0 ? (
                      <TouchableOpacity
                        style={[s.blockEmptyHint, { borderTopColor: C.border }]}
                        onPress={() => { setSelectedBlockId(block.localId); setBuilderTab('libreria'); }}
                      >
                        <Text style={[s.blockEmptyHintText, { color: Colors.primary }]}>
                          Añadir ejercicios desde la librería
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      block.exercises.map(ex => (
                        <View
                          key={ex.localId}
                          style={[s.exCard, { borderTopColor: C.border }]}
                        >
                          <View style={s.exCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.exCardName, { color: C.text }]}>{ex.name}</Text>
                              <Text style={[s.exCardSub, { color: C.textSub }]}>{ex.muscle_group}</Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => removeExercise(block.localId, ex.localId)}
                              style={s.iconBtn}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel="Quitar ejercicio"
                            >
                              <X size={18} color={C.textSub} />
                            </TouchableOpacity>
                          </View>
                          <View style={s.exCardStats}>
                            {(['series', 'objetivo', 'descanso'] as const).map(field => (
                              <View key={field} style={[s.exStat, { backgroundColor: C.bg, borderColor: C.border }]}>
                                <Text style={[s.exStatLabel, { color: C.textSub }]}>
                                  {field === 'series' ? 'Series' : field === 'objetivo' ? 'Objetivo' : 'Descanso'}
                                </Text>
                                <TextInput
                                  style={[s.exStatInput, { color: C.text }]}
                                  value={ex[field]}
                                  onChangeText={v => updateExercise(block.localId, ex.localId, field, v)}
                                  keyboardType={field === 'series' ? 'numeric' : 'default'}
                                />
                              </View>
                            ))}
                          </View>
                        </View>
                      ))
                    )}
                    {block.exercises.length > 0 && (
                      <TouchableOpacity
                        style={[s.addExBtn, { borderTopColor: C.border }]}
                        onPress={() => { setSelectedBlockId(block.localId); setBuilderTab('libreria'); }}
                      >
                        <Plus size={16} color={Colors.primary} />
                        <Text style={[s.addExBtnText, { color: Colors.primary }]}>Añadir ejercicio</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            );
          })}
          <TouchableOpacity
            style={[s.addAnotherBlock, { borderColor: C.border }]}
            onPress={addBlock}
            activeOpacity={0.7}
          >
            <Plus size={18} color={Colors.primary} />
            <Text style={[s.addAnotherBlockText, { color: Colors.primary }]}>Añadir otro bloque</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  // ─── Panel Librería ───────────────────────────────────────────────────────────
  const LibraryPanel = () => (
    <View style={{ flex: 1 }}>
      <View style={[
        s.libBanner,
        selectedBlock
          ? { backgroundColor: C.surface, borderBottomColor: C.border }
          : { backgroundColor: '#FFFBEB', borderBottomColor: '#FDE68A' },
      ]}>
        {selectedBlock ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={[s.activeBlockDot, { backgroundColor: selectedBlock.color }]} />
            <Text style={[s.libBannerText, { color: C.textSub }]} numberOfLines={1}>
              Añadiendo a <Text style={{ fontFamily: FBB, color: C.text }}>{selectedBlock.name}</Text>
            </Text>
          </View>
        ) : (
          <Text style={[s.libBannerText, { color: '#92400E' }]}>Selecciona un bloque primero</Text>
        )}
        {!isTablet && (
          <TouchableOpacity onPress={() => setBuilderTab('bloques')} style={s.libBackBtn}>
            <ChevronLeft size={16} color={selectedBlock ? C.textSub : '#92400E'} />
            <Text style={{ fontSize: 13, fontFamily: FBB, color: selectedBlock ? C.textSub : '#92400E' }}>Bloques</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[s.libSearchRow, { backgroundColor: C.bg }]}>
        <View style={[s.searchBox, { borderColor: C.border, backgroundColor: C.surface }]}>
          <Search size={16} color={C.textSub} />
          <TextInput
            style={[s.searchInput, { color: C.text }]}
            placeholder="Buscar ejercicio"
            placeholderTextColor={C.textSub}
            value={librarySearch}
            onChangeText={setLibrarySearch}
          />
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.libFilters}>
          {MUSCLE_GROUPS.map(g => {
            const active = libraryFilter === g;
            return (
              <TouchableOpacity
                key={g}
                style={[
                  s.libChip,
                  {
                    backgroundColor: active ? tint : 'transparent',
                    borderColor: active ? Colors.primary : C.border,
                  },
                ]}
                onPress={() => setLibraryFilter(g)}
              >
                <Text style={[s.libChipText, { color: active ? C.text : C.textSub }]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Text style={[s.libCount, { color: C.textSub, borderBottomColor: C.border }]}>
        {filteredLibrary.length} ejercicios
      </Text>

      {filteredLibrary.length === 0 ? (
        <View style={{ padding: 16 }}>
          <View style={[s.emptyCard, { borderColor: C.border }]}>
            <Text style={[s.emptySub, { color: C.textSub }]}>Ningún ejercicio coincide con la búsqueda</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredLibrary}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const alreadyAdded = selectedBlock?.exercises.some(e => e.exerciseId === item.id) ?? false;
            return (
              <TouchableOpacity
                style={[
                  s.libItem,
                  {
                    borderBottomColor: C.border,
                    backgroundColor: C.surface,
                    opacity: !selectedBlock ? 0.55 : 1,
                  }
                ]}
                onPress={() => addFromLibrary(item)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.libName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.libTagText, { color: C.textSub }]} numberOfLines={1}>
                    {item.muscle_group}
                    {item.description ? ` · ${item.description}` : ''}
                  </Text>
                </View>
                {alreadyAdded ? (
                  <View style={[s.libAddCircle, { borderColor: Colors.primary, backgroundColor: tint }]}>
                    <Check size={16} color={Colors.primary} />
                  </View>
                ) : (
                  <View style={[s.libAddCircle, { borderColor: C.border }]}>
                    <Plus size={18} color={selectedBlock ? Colors.primary : C.textSub} />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]} edges={['top']}>

      {/* ── Modal: nombre de nueva rutina ── */}
      <Modal visible={showNameModal} transparent animationType="slide">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.modalTitleRow}>
              <Text style={[s.modalTitle, { color: C.text }]}>Nueva rutina</Text>
              <TouchableOpacity
                onPress={() => setShowNameModal(false)}
                style={s.modalClose}
                accessibilityLabel="Cerrar"
              >
                <X size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: C.textSub }]}>
              Dale un nombre a tu rutina antes de empezar
            </Text>
            <TextInput
              style={[s.nameInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
              placeholder="Ej: Fuerza lunes, Full body"
              placeholderTextColor={C.textSub}
              value={pendingRoutineName}
              onChangeText={setPendingRoutineName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmNameAndOpenBuilder}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.btnCancel, { borderColor: C.border }]}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={[s.btnCancelText, { color: C.textSub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1, marginTop: 0, opacity: pendingRoutineName.trim() ? 1 : 0.5 }]}
                onPress={confirmNameAndOpenBuilder}
                disabled={!pendingRoutineName.trim()}
              >
                <Text style={s.btnPrimaryText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: asignar rutina ── */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.modalTitleRow}>
              <Text style={[s.modalTitle, { color: C.text }]}>Asignar rutina</Text>
              <TouchableOpacity
                onPress={() => setShowAssignModal(false)}
                style={s.modalClose}
                accessibilityLabel="Cerrar"
              >
                <X size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>

            <Text style={[s.modalRoutine, { color: C.text }]} numberOfLines={1}>{selectedRoutine?.name}</Text>
            <Text style={[s.modalSub, { color: C.textSub }]}>
              Selecciona quién recibirá esta rutina
            </Text>

            {users.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: C.border, marginBottom: 12 }]}>
                <Text style={[s.emptySub, { color: C.textSub }]}>
                  No hay otros usuarios disponibles. Solo los admins pueden asignar rutinas.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                {users.map(user => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        s.assignRow,
                        {
                          borderColor: isSelected ? Colors.primary : C.border,
                          backgroundColor: isSelected ? tint : C.surface,
                        }
                      ]}
                      onPress={() => setSelectedUserIds(prev =>
                        prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                      )}
                      activeOpacity={0.7}
                    >
                      <View style={[s.userAvatar, { backgroundColor: isSelected ? Colors.primary : C.bg }]}>
                        <Text style={{ color: isSelected ? '#fff' : C.text, fontFamily: FC, fontSize: 18 }}>
                          {user.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.assignName, { color: C.text }]} numberOfLines={1}>{user.name || 'Sin nombre'}</Text>
                        <Text style={[s.assignSub, { color: C.textSub }]} numberOfLines={1}>{user.email || 'Sin email'}</Text>
                      </View>
                      <View style={[
                        s.checkCircle,
                        isSelected
                          ? { backgroundColor: Colors.primary }
                          : { borderWidth: 1, borderColor: C.border },
                      ]}>
                        {isSelected && <Check size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={[s.fieldLabel, { color: C.textSub }]}>Fecha</Text>
            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={C.textSub}
              value={assignDate}
              onChangeText={setAssignDate}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={[s.fieldLabel, { color: C.textSub }]}>Nota para el usuario (opcional)</Text>
            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg, minHeight: 64 }]}
              placeholder="Escribe una nota"
              placeholderTextColor={C.textSub}
              value={assignNote}
              onChangeText={setAssignNote}
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={[s.btnPrimary, { opacity: canAssign ? 1 : 0.5 }]}
              onPress={confirmAssign}
              disabled={!canAssign}
            >
              {assigning
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>Asignar rutina</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: ver asignaciones ── */}
      <Modal visible={showAssignmentsModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.modalTitleRow}>
              <Text style={[s.modalTitle, { color: C.text }]}>Asignaciones</Text>
              <TouchableOpacity
                onPress={() => setShowAssignmentsModal(false)}
                style={s.modalClose}
                accessibilityLabel="Cerrar"
              >
                <X size={20} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalRoutine, { color: C.text }]} numberOfLines={1}>{selectedRoutine?.name}</Text>

            {loadingAssignments ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 24 }} />
            ) : routineAssignments.length === 0 ? (
              <View style={[s.emptyCard, { borderColor: C.border, marginTop: 12 }]}>
                <Text style={[s.emptySub, { color: C.textSub }]}>Esta rutina aún no está asignada a nadie</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300, marginTop: 8 }}>
                {routineAssignments.map((a, i, arr) => {
                  const assignedUser = users.find(u => u.id === a.assigned_to_id);
                  return (
                    <View
                      key={a.id}
                      style={[
                        s.assignmentRow,
                        { borderBottomColor: C.border, borderBottomWidth: i === arr.length - 1 ? 0 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.assignName, { color: C.text }]} numberOfLines={1}>
                          {assignedUser?.name ?? `Usuario #${a.assigned_to_id}`}
                        </Text>
                        <Text style={[s.assignSub, { color: C.textSub }]}>
                          {String(a.date ?? '').split('T')[0]}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={s.deleteAssignBtn}
                        onPress={() => handleDeleteAssignment(a.id)}
                      >
                        <Text style={{ color: C.error, fontSize: 14, fontFamily: FBB }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════
          MODO BUILDER
      ════════════════════════════════════════════════════ */}
      {mode === 'builder' ? (
        <View style={{ flex: 1 }}>
          {/* Barra superior */}
          <View style={[s.builderTopbar, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
            <TouchableOpacity
              style={s.builderBackBtn}
              onPress={() => {
                Alert.alert(
                  'Salir del editor',
                  '¿Seguro? Los cambios no guardados se perderán.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', style: 'destructive', onPress: () => { setMode('list'); setEditingRoutineId(null); } }
                  ]
                );
              }}
            >
              <ChevronLeft size={20} color={C.text} />
              <Text style={[s.builderBackText, { color: C.text }]}>Volver</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.builderTopbarTitle, { color: C.text }]} numberOfLines={1}>{routineName}</Text>
              <Text style={[s.builderTopbarSub, { color: C.textSub }]}>
                {blocks.length} bloque{blocks.length !== 1 ? 's' : ''} · {totalExercises} ejercicio{totalExercises !== 1 ? 's' : ''}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.builderSaveBtn, { backgroundColor: Colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={saveRoutine}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.builderSaveText}>
                    {editingRoutineId ? 'Actualizar' : 'Guardar'}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* Pestañas */}
          <View style={[s.tabBar, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
            {(['bloques', 'libreria'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, builderTab === tab && { borderBottomWidth: 2, borderBottomColor: Colors.primary }]}
                onPress={() => setBuilderTab(tab)}
              >
                <Text style={[s.tabText, { color: builderTab === tab ? C.text : C.textSub }]}>
                  {tab === 'bloques' ? `Bloques (${blocks.length})` : 'Librería'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isTablet ? (
            <View style={[s.builderMain, { backgroundColor: C.bg }]}>
              <View style={[s.panelLeft, { borderRightColor: C.border }]}>
                {BlocksPanel()}
              </View>
              <View style={s.panelRight}>
                {LibraryPanel()}
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: C.bg }}>
              {builderTab === 'bloques' ? BlocksPanel() : LibraryPanel()}
            </View>
          )}
        </View>

      ) : (
        /* ════════════════════════════════════════════════════
           MODO LISTA
        ════════════════════════════════════════════════════ */
        <>
          {/* Título + acciones */}
          <View style={s.titleRow}>
            <Text style={[s.pageTitle, { color: C.text }]}>Rutinas</Text>
            <View style={s.titleActions}>
              <TouchableOpacity
                style={s.logoutBtn}
                onPress={async () => { await deleteToken(); router.replace('/auth/login'); }}
                accessibilityLabel="Cerrar sesión"
              >
                <LogOut size={16} color={C.textSub} />
                <Text style={[s.logoutText, { color: C.textSub }]}>Salir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.createBtn} onPress={openBuilder} activeOpacity={0.85}>
                <Plus size={18} color="#fff" />
                <Text style={s.createBtnText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Resumen: un solo contenedor dividido por líneas */}
          <View style={[s.heroStats, { backgroundColor: C.surface, borderColor: C.border }]}>
            <View style={s.heroStatItem}>
              <Text style={[s.heroStatLbl, { color: C.textSub }]}>Rutinas</Text>
              <Text style={[s.heroStatVal, { color: C.text }]}>{routines.length}</Text>
            </View>
            <View style={[s.heroStatDivider, { backgroundColor: C.border }]} />
            <View style={s.heroStatItem}>
              <Text style={[s.heroStatLbl, { color: C.textSub }]}>Ejercicios</Text>
              <Text style={[s.heroStatVal, { color: C.text }]}>{totalExercisesInRoutines}</Text>
            </View>
            <View style={[s.heroStatDivider, { backgroundColor: C.border }]} />
            <View style={s.heroStatItem}>
              <Text style={[s.heroStatLbl, { color: C.textSub }]}>Usuarios</Text>
              <Text style={[s.heroStatVal, { color: C.text }]}>{users.length}</Text>
            </View>
          </View>

          {/* Buscador */}
          <View style={s.heroSearchWrap}>
            <View style={[s.searchBox, { borderColor: C.border, backgroundColor: C.surface }]}>
              <Search size={16} color={C.textSub} />
              <TextInput
                style={[s.searchInput, { color: C.text }]}
                placeholder="Buscar rutinas"
                placeholderTextColor={C.textSub}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* ── Lista ── */}
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ color: C.textSub, marginTop: 12, fontFamily: FB, fontSize: 14 }}>Cargando rutinas…</Text>
            </View>
          ) : filteredRoutines.length === 0 ? (
            <View style={{ padding: 16 }}>
              <View style={[s.emptyCard, { borderColor: C.border }]}>
                {routines.length === 0 ? (
                  <>
                    <Text style={[s.emptyTitle, { color: C.text }]}>Sin rutinas</Text>
                    <Text style={[s.emptySub, { color: C.textSub }]}>
                      Pulsa Crear para construir tu primera rutina
                    </Text>
                    <TouchableOpacity style={s.emptyAddBtn} onPress={openBuilder} activeOpacity={0.85}>
                      <Plus size={18} color="#fff" />
                      <Text style={s.emptyAddText}>Crear primera rutina</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[s.emptySub, { color: C.textSub }]}>
                    Ninguna rutina coincide con «{searchQuery}»
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <FlatList
              data={filteredRoutines}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: routine }) => {
                const allExercises = (routine.blocks ?? []).flatMap(b => b.exercises ?? []);
                const totalEx = allExercises.length;

                return (
                  <View style={[s.routineCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    {/* Cabecera de la tarjeta */}
                    <View style={s.routineCardHeader}>
                      <Text style={[s.routineCardName, { color: C.text }]} numberOfLines={1}>{routine.name}</Text>
                      <Text style={[s.routineCardSub, { color: C.textSub }]}>
                        {totalEx} ejercicio{totalEx !== 1 ? 's' : ''}
                        {(routine.blocks ?? []).length > 0
                          ? ` · ${(routine.blocks ?? []).length} bloque${(routine.blocks ?? []).length !== 1 ? 's' : ''}`
                          : ''}
                      </Text>
                    </View>

                    {/* Ejercicios: etiquetas neutras */}
                    {totalEx > 0 && (
                      <View style={s.exercisesPreview}>
                        {allExercises.slice(0, 4).map(ex => {
                          const exData = ex.exercise ?? ex;
                          return (
                            <View key={ex.id} style={[s.exPill, { backgroundColor: C.bg }]}>
                              <Text style={[s.exPillText, { color: C.textSub }]} numberOfLines={1}>{exData.name}</Text>
                            </View>
                          );
                        })}
                        {totalEx > 4 && (
                          <View style={[s.exPill, { backgroundColor: tint }]}>
                            <Text style={[s.exPillText, { color: isDark ? C.text : Colors.primary }]}>+{totalEx - 4} más</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Acciones */}
                    <View style={[s.routineCardFooter, { borderTopColor: C.border }]}>
                      <TouchableOpacity
                        style={[s.footerBtn, { borderRightColor: C.border }]}
                        onPress={() => openAssignModal(routine)}
                        activeOpacity={0.7}
                        accessibilityLabel="Asignar rutina"
                      >
                        <UserPlus size={16} color={Colors.primary} />
                        <Text style={[s.footerBtnText, { color: isDark ? C.text : Colors.primary }]}>Asignar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, { borderRightColor: C.border }]}
                        onPress={() => openAssignmentsModal(routine)}
                        activeOpacity={0.7}
                        accessibilityLabel="Ver asignaciones"
                      >
                        <CalendarDays size={16} color={C.textSub} />
                        <Text style={[s.footerBtnText, { color: C.text }]}>Ver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, { borderRightColor: C.border }]}
                        onPress={() => openEditRoutine(routine)}
                        activeOpacity={0.7}
                        accessibilityLabel="Editar rutina"
                      >
                        <Pencil size={16} color={C.textSub} />
                        <Text style={[s.footerBtnText, { color: C.text }]}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, { borderRightWidth: 0 }]}
                        onPress={() => handleDeleteRoutine(routine)}
                        activeOpacity={0.7}
                        accessibilityLabel="Borrar rutina"
                      >
                        <Trash2 size={16} color={C.error} />
                        <Text style={[s.footerBtnText, { color: C.error }]}>Borrar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ───────────────────────────────────────────────────────────────────
// Radios: tarjetas 14, controles 12, hojas 20, chips 99. Sin sombras ni degradados.
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Título + acciones ──
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 30, lineHeight: 32, fontFamily: FC },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 44, paddingHorizontal: 10,
  },
  logoutText: { fontSize: 14, fontFamily: FBB },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary,
    minHeight: 44, paddingHorizontal: 16, borderRadius: 12,
  },
  createBtnText: { color: '#fff', fontSize: 15, fontFamily: FBB },

  // ── Resumen: un contenedor dividido por líneas ──
  heroStats: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroStatItem: { flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 4 },
  heroStatVal: { fontSize: 30, lineHeight: 32, fontFamily: FC, fontVariant: ['tabular-nums'] },
  heroStatLbl: { fontSize: 12, fontFamily: FB },
  heroStatDivider: { width: 1, alignSelf: 'stretch', marginVertical: 14 },

  // ── Buscador ──
  heroSearchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: FB, paddingVertical: 8 },

  // ── Tarjeta de rutina ──
  routineCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  routineCardHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 3 },
  routineCardName: { fontSize: 17, fontFamily: FBB },
  routineCardSub: { fontSize: 13, fontFamily: FB },

  exercisesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  exPill: {
    paddingHorizontal: 10,
    height: 26,
    justifyContent: 'center',
    borderRadius: 8,
    maxWidth: '100%',
  },
  exPillText: { fontSize: 12, fontFamily: FBB },

  routineCardFooter: { flexDirection: 'row', borderTopWidth: 1 },
  footerBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRightWidth: 1,
  },
  footerBtnText: { fontSize: 13, fontFamily: FBB },

  // ── Builder ──
  builderTopbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  builderBackBtn: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 44, paddingRight: 8,
  },
  builderBackText: { fontSize: 15, fontFamily: FBB },
  builderTopbarTitle: { fontSize: 20, lineHeight: 22, fontFamily: FC },
  builderTopbarSub: { fontSize: 12, fontFamily: FB, marginTop: 2 },
  builderSaveBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderSaveText: { color: '#fff', fontSize: 14, fontFamily: FBB },
  builderMain: { flex: 1, flexDirection: 'row' },
  panelLeft: { flex: 1, borderRightWidth: 1 },
  panelRight: { width: 300 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  tabText: { fontSize: 14, fontFamily: FBB },

  panelContent: { padding: 16, gap: 12, paddingBottom: 120 },

  // ── Vacío: conserva el marco con borde discontinuo ──
  emptyCard: {
    borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
    paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center', gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: FBB, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: FB, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary,
    minHeight: 48, paddingHorizontal: 20, borderRadius: 12,
    marginTop: 8,
  },
  emptyAddText: { color: '#fff', fontSize: 15, fontFamily: FBB },

  // ── Bloques ──
  blockCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 56,
  },
  blockDot: { width: 8, height: 8, borderRadius: 4 },
  blockNameInput: { flex: 1, fontSize: 16, fontFamily: FBB, padding: 0, minHeight: 44 },
  blockCountBadge: {
    minWidth: 26, height: 22, paddingHorizontal: 8,
    borderRadius: 99, alignItems: 'center', justifyContent: 'center',
  },
  blockCountText: { fontSize: 12, fontFamily: FBB, fontVariant: ['tabular-nums'] },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  blockEmptyHint: {
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  blockEmptyHintText: { fontSize: 14, fontFamily: FBB },

  exCard: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  exCardName: { fontSize: 15, fontFamily: FBB },
  exCardSub: { fontSize: 12, fontFamily: FB, marginTop: 2 },
  exCardStats: { flexDirection: 'row', gap: 8 },
  exStat: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  exStatLabel: { fontSize: 12, fontFamily: FB },
  exStatInput: { width: '100%', fontSize: 15, fontFamily: FBB, padding: 0, minHeight: 24 },

  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderTopWidth: 1,
  },
  addExBtnText: { fontSize: 14, fontFamily: FBB },
  addAnotherBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addAnotherBlockText: { fontSize: 15, fontFamily: FBB },

  // ── Librería ──
  libBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    borderBottomWidth: 1,
  },
  libBannerText: { fontSize: 14, fontFamily: FB },
  libBackBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  activeBlockDot: { width: 8, height: 8, borderRadius: 4 },
  libSearchRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  libFilters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  libChip: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
  },
  libChipText: { fontSize: 13, fontFamily: FBB },
  libCount: { fontSize: 12, fontFamily: FB, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1 },
  libItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 64,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  libName: { fontSize: 15, fontFamily: FBB },
  libTagText: { fontSize: 12, fontFamily: FB, marginTop: 2 },
  libAddCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Modales (hojas inferiores) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 24, lineHeight: 26, fontFamily: FC, flex: 1 },
  modalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  modalRoutine: { fontSize: 16, fontFamily: FBB, marginBottom: 4 },
  modalSub: { fontSize: 14, fontFamily: FB, lineHeight: 20, marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: FBB, marginTop: 12, marginBottom: 6 },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 16,
    fontFamily: FB,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FB,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: {
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  btnCancelText: { fontSize: 15, fontFamily: FBB },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontFamily: FBB },

  // Asignar
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    minHeight: 60,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignName: { fontSize: 15, fontFamily: FBB },
  assignSub: { fontSize: 12, fontFamily: FB, marginTop: 2 },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 8,
  },
  deleteAssignBtn: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
});
