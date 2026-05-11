import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, Dimensions, TextInput, Modal,
  FlatList, Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import {
  getExercises, createRoutine, assignRoutine, getUsers, deleteToken, deleteRoutine,
  getAssignmentsByRoutine, deleteAssignment, getToken, updateRoutineFull
} from '../../services/api';
import { useRoutines, type Routine, type Exercise } from '../../hooks/useRoutines';

// ─── Tipos builder ─────────────────────────────────────────────────────────────
type BlockExercise = {
  localId: string; exerciseId: number; name: string;
  muscle_group: string; series: string; objetivo: string; descanso: string;
};
type Block = { localId: string; name: string; color: string; collapsed: boolean; exercises: BlockExercise[] };
type User = { id: number; name: string; email: string; role: string };

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const BLOCK_COLORS = ['#3B6D11', '#10B981', '#6366F1', '#F59E0B', '#EC4899', '#14B8A6'];
const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Piernas', 'Hombros', 'Bíceps', 'Tríceps', 'Core'];
const uid = () => Date.now().toString() + Math.random().toString(36).slice(2, 6);

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
const gc = (g: string) => GROUP_COLORS[g] ?? GROUP_COLORS.default;

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

  const C = {
    bg:      isDark ? '#0F172A' : '#F5F5F5',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    card:    isDark ? '#1E293B' : '#FFFFFF',
    text:    isDark ? '#F1F5F9' : '#1A1A1A',
    textSub: isDark ? '#94A3B8' : '#64748B',
    border:  isDark ? '#334155' : '#E2E8F0',
    error:   '#EF4444',
    heroText: isDark ? '#C0DD97' : '#EAF3DE',
    heroSub:  isDark ? '#97C459' : '#C0DD97',
  };

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
        Alert.alert('✓ Rutina actualizada');
      } else {
        const routine = await createRoutine(payload.name);
        await updateRoutineFull(routine.id, payload.name, payload.blocks);
        Alert.alert('✓ Rutina creada');
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
      Alert.alert('✓ Asignadas correctamente');
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
      Alert.alert('✓ Eliminada');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  // ─── Borrar rutina ────────────────────────────────────────────────────────────
  const handleDeleteRoutine = (routine: Routine) => {
    if (window.confirm(`¿Eliminar "${routine.name}"?`)) {
      deleteRoutine(routine.id)
        .then(() => reload())
        .then(() => window.alert('✓ Eliminada'))
        .catch((err: any) => window.alert('Error: ' + err.message));
    }
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

  // ─── Stats para el hero ───────────────────────────────────────────────────────
  const totalExercisesInRoutines = routines.reduce((sum, r) => {
    return sum + (r.blocks ?? []).flatMap(b => b.exercises ?? []).length;
  }, 0);

  // ─── Panel Bloques ────────────────────────────────────────────────────────────
  const BlocksPanel = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      {blocks.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Text style={{ fontSize: 32 }}>📋</Text>
          </View>
          <Text style={[s.emptyTitle, { color: C.text }]}>Sin bloques todavía</Text>
          <Text style={[s.emptySub, { color: C.textSub }]}>Crea tu primer bloque{'\n'}(ej: Calentamiento, Fuerza…)</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={addBlock}>
            <Text style={s.emptyAddText}>+ Añadir primer bloque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {blocks.map(block => (
            <View key={block.localId}>
              <TouchableOpacity
                onPress={() => { setSelectedBlockId(block.localId); toggleCollapse(block.localId); }}
                style={[
                  s.blockHead,
                  {
                    borderLeftColor: block.color,
                    backgroundColor: selectedBlockId === block.localId ? block.color + '15' : C.surface,
                    borderBottomColor: C.border,
                  }
                ]}
              >
                <View style={[s.blockDot, { backgroundColor: block.color }]} />
                <TextInput
                  style={[s.blockNameInput, { color: C.text }]}
                  value={block.name}
                  onChangeText={v => updateBlockName(block.localId, v)}
                  onFocus={() => setSelectedBlockId(block.localId)}
                />
                <View style={[s.blockCountBadge, { backgroundColor: block.color + '20' }]}>
                  <Text style={[s.blockCountText, { color: block.color }]}>{block.exercises.length}</Text>
                </View>
                <Text style={{ color: C.textSub, fontSize: 14, marginLeft: 4 }}>
                  {block.collapsed ? '›' : '⌃'}
                </Text>
                <TouchableOpacity onPress={() => removeBlock(block.localId)} style={s.blockRemoveBtn}>
                  <Text style={{ color: C.error, fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {!block.collapsed && (
                <>
                  {block.exercises.length === 0 ? (
                    <TouchableOpacity
                      style={[s.blockEmptyHint, { borderLeftColor: block.color + '66', borderBottomColor: C.border, backgroundColor: block.color + '08' }]}
                      onPress={() => { setSelectedBlockId(block.localId); setBuilderTab('libreria'); }}
                    >
                      <Text style={[s.blockEmptyHintText, { color: block.color }]}>
                        + Toca para añadir ejercicios desde la librería
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    block.exercises.map(ex => {
                      const colors = gc(ex.muscle_group);
                      return (
                        <View
                          key={ex.localId}
                          style={[s.exCard, { borderLeftColor: block.color, backgroundColor: C.surface, borderColor: C.border }]}
                        >
                          <View style={s.exCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.exCardName, { color: C.text }]}>{ex.name}</Text>
                              <View style={[s.muscleBadge, { backgroundColor: colors.bg }]}>
                                <Text style={[s.muscleBadgeText, { color: colors.text }]}>{ex.muscle_group}</Text>
                              </View>
                            </View>
                            <TouchableOpacity onPress={() => removeExercise(block.localId, ex.localId)} style={{ padding: 4 }}>
                              <Text style={{ color: C.error, fontSize: 13 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.exCardStats}>
                            {(['series', 'objetivo', 'descanso'] as const).map(field => (
                              <View key={field} style={[s.exStat, { backgroundColor: C.bg, borderColor: C.border }]}>
                                <Text style={[s.exStatLabel, { color: C.textSub }]}>
                                  {field === 'series' ? 'SERIES' : field === 'objetivo' ? 'OBJETIVO' : 'DESCANSO'}
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
                      );
                    })
                  )}
                  {block.exercises.length > 0 && (
                    <TouchableOpacity
                      style={[s.addExBtn, { borderColor: block.color + '55', borderLeftColor: block.color, backgroundColor: block.color + '06' }]}
                      onPress={() => { setSelectedBlockId(block.localId); setBuilderTab('libreria'); }}
                    >
                      <Text style={[s.addExBtnText, { color: block.color }]}>+ Añadir ejercicio</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ))}
          <TouchableOpacity
            style={[s.addAnotherBlock, { borderColor: Colors.primary + '55', backgroundColor: Colors.primaryLight }]}
            onPress={addBlock}
          >
            <Text style={[s.addAnotherBlockText, { color: Colors.primary }]}>+ Añadir otro bloque</Text>
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
        {
          backgroundColor: selectedBlock ? selectedBlock.color + '12' : '#F59E0B12',
          borderBottomColor: selectedBlock ? selectedBlock.color + '33' : '#F59E0B33',
        }
      ]}>
        {selectedBlock ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.activeBlockDot, { backgroundColor: selectedBlock.color }]} />
            <Text style={[s.libBannerText, { color: selectedBlock.color }]}>
              Añadiendo a: <Text style={{ fontWeight: '700' }}>{selectedBlock.name}</Text>
            </Text>
          </View>
        ) : (
          <Text style={[s.libBannerText, { color: '#F59E0B' }]}>⚠️ Selecciona un bloque primero</Text>
        )}
        {!isTablet && (
          <TouchableOpacity onPress={() => setBuilderTab('bloques')}>
            <Text style={{ fontSize: 12, color: C.textSub }}>← Bloques</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[s.libSearchRow, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
        <TextInput
          style={[s.libSearchInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          placeholder="Buscar ejercicio..."
          placeholderTextColor={C.textSub}
          value={librarySearch}
          onChangeText={setLibrarySearch}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.libFilters}>
        {MUSCLE_GROUPS.map(g => (
          <TouchableOpacity
            key={g}
            style={[
              s.libChip,
              {
                backgroundColor: libraryFilter === g ? Colors.primary : C.surface,
                borderColor: libraryFilter === g ? Colors.primary : C.border,
              }
            ]}
            onPress={() => setLibraryFilter(g)}
          >
            <Text style={[s.libChipText, { color: libraryFilter === g ? '#fff' : C.textSub }]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[s.libCount, { color: C.textSub, borderBottomColor: C.border }]}>
        {filteredLibrary.length} ejercicios
      </Text>

      {filteredLibrary.length === 0 ? (
        <View style={[s.empty, { paddingTop: 40 }]}>
          <Text style={{ fontSize: 32 }}>🔍</Text>
          <Text style={[s.emptySub, { color: C.textSub }]}>Sin resultados</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLibrary}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const colors = gc(item.muscle_group);
            const alreadyAdded = selectedBlock?.exercises.some(e => e.exerciseId === item.id) ?? false;
            return (
              <TouchableOpacity
                style={[
                  s.libItem,
                  {
                    borderBottomColor: C.border,
                    backgroundColor: C.surface,
                    opacity: !selectedBlock ? 0.4 : 1,
                  }
                ]}
                onPress={() => addFromLibrary(item)}
                activeOpacity={0.7}
              >
                <View style={[s.libThumb, { backgroundColor: colors.bg }]}>
                  <Text style={{ fontSize: 16, color: colors.accent }}>💪</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.libName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.libTag, { backgroundColor: colors.bg }]}>
                    <Text style={[s.libTagText, { color: colors.text }]}>{item.muscle_group}</Text>
                  </View>
                  {item.description && (
                    <Text style={[s.libDesc, { color: C.textSub }]} numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
                {alreadyAdded ? (
                  <View style={[s.libAddCircle, { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }]}>
                    <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '700' }}>✓</Text>
                  </View>
                ) : (
                  <View style={[
                    s.libAddCircle,
                    {
                      borderColor: selectedBlock ? selectedBlock.color : C.border,
                      backgroundColor: selectedBlock ? selectedBlock.color + '15' : 'transparent',
                    }
                  ]}>
                    <Text style={{ color: selectedBlock ? selectedBlock.color : C.textSub, fontSize: 18 }}>+</Text>
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
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>

      {/* ── Modal: nombre de nueva rutina ── */}
      <Modal visible={showNameModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.modalTitleRow}>
              <View style={s.modalTitleIcon}>
                <Text style={{ fontSize: 18 }}>📋</Text>
              </View>
              <Text style={[s.modalTitle, { color: C.text }]}>Nueva rutina</Text>
              <TouchableOpacity onPress={() => setShowNameModal(false)} style={s.modalClose}>
                <Text style={{ color: C.textSub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: C.textSub }]}>
              Dale un nombre a tu rutina antes de empezar
            </Text>
            <TextInput
              style={[s.nameInput, { color: C.text, borderColor: Colors.primary + '55', backgroundColor: Colors.primaryLight + '55' }]}
              placeholder="Ej: Fuerza lunes, Full body..."
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
                <Text style={s.btnPrimaryText}>Continuar →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: asignar rutina ── */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.modalTitleRow}>
              <View style={s.modalTitleIcon}>
                <Text style={{ fontSize: 18 }}>👤</Text>
              </View>
              <Text style={[s.modalTitle, { color: C.text }]}>Asignar rutina</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)} style={s.modalClose}>
                <Text style={{ color: C.textSub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.assignBadge}>
              <Text style={s.assignBadgeText} numberOfLines={1}>💪 {selectedRoutine?.name}</Text>
            </View>

            <Text style={[s.modalSub, { color: C.textSub }]}>
              Selecciona el usuario que recibirá esta rutina
            </Text>

            {users.length === 0 ? (
              <Text style={{ color: C.textSub, textAlign: 'center', marginVertical: 20, fontSize: 13 }}>
                No hay otros usuarios disponibles.{'\n'}Solo admins pueden asignar rutinas.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 220 }}>
                {users.map(user => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        s.assignRow,
                        {
                          borderColor: isSelected ? Colors.primary : C.border,
                          backgroundColor: isSelected ? Colors.primaryLight : C.surface,
                        }
                      ]}
                      onPress={() => setSelectedUserIds(prev =>
                        prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]
                      )}
                    >
                      <View style={[s.userAvatar, { backgroundColor: isSelected ? Colors.primary : Colors.primaryLight }]}>
                        <Text style={{ color: isSelected ? '#fff' : Colors.primary, fontWeight: '700', fontSize: 14 }}>
                          {user.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.assignName, { color: C.text }]}>{user.name || 'Sin nombre'}</Text>
                        <Text style={[s.assignSub, { color: C.textSub }]}>{user.email || 'Sin email'}</Text>
                      </View>
                      <View style={[s.checkCircle, { backgroundColor: isSelected ? Colors.primary : C.border + '44', borderWidth: isSelected ? 0 : 1, borderColor: C.border }]}>
                        <Text style={{ color: isSelected ? '#fff' : C.textSub, fontSize: 12, fontWeight: '700' }}>
                          {isSelected ? '✓' : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
              placeholder="Nota opcional para el usuario..."
              placeholderTextColor={C.textSub}
              value={assignNote}
              onChangeText={setAssignNote}
              multiline
              numberOfLines={2}
            />
            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg, marginTop: 8 }]}
              placeholder="Fecha (YYYY-MM-DD)"
              placeholderTextColor={C.textSub}
              value={assignDate}
              onChangeText={setAssignDate}
            />

            <TouchableOpacity
              style={[
                s.btnPrimary,
                { opacity: selectedUserIds.length > 0 && assignDate && !assigning ? 1 : 0.5 }
              ]}
              onPress={confirmAssign}
              disabled={selectedUserIds.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(assignDate) || assigning}
            >
              {assigning
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimaryText}>Asignar rutina</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: ver asignaciones ── */}
      <Modal visible={showAssignmentsModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={s.modalTitleRow}>
              <View style={s.modalTitleIcon}>
                <Text style={{ fontSize: 18 }}>📅</Text>
              </View>
              <Text style={[s.modalTitle, { color: C.text }]}>Asignaciones</Text>
              <TouchableOpacity onPress={() => setShowAssignmentsModal(false)} style={s.modalClose}>
                <Text style={{ color: C.textSub, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.assignBadge}>
              <Text style={s.assignBadgeText} numberOfLines={1}>💪 {selectedRoutine?.name}</Text>
            </View>
            {loadingAssignments ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : routineAssignments.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
                <Text style={{ color: C.textSub, fontSize: 14 }}>No hay asignaciones aún</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {routineAssignments.map(a => (
                  <View
                    key={a.id}
                    style={[s.assignmentRow, { borderBottomColor: C.border, backgroundColor: C.surface }]}
                  >
                    <View style={[s.userAvatar, { backgroundColor: Colors.primaryLight }]}>
                      <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>
                        {String(a.assigned_to_id).slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
                        Usuario #{a.assigned_to_id}
                      </Text>
                      <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{a.date}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.deleteAssignBtn}
                      onPress={() => handleDeleteAssignment(a.id)}
                    >
                      <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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
          {/* Topbar builder */}
          <View style={[s.builderTopbar, { borderBottomColor: C.border, backgroundColor: Colors.primary }]}>
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
              <Text style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: '500' }}>← Volver</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.builderTopbarTitle} numberOfLines={1}>{routineName}</Text>
              <Text style={s.builderTopbarSub}>{blocks.length} bloques · {totalExercises} ejercicios</Text>
            </View>

            <TouchableOpacity
              style={[s.builderSaveBtn, { backgroundColor: saving ? Colors.primaryDark : Colors.primaryDark }]}
              onPress={saveRoutine}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={Colors.primaryLight} size="small" />
                : <Text style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: '700' }}>
                    {editingRoutineId ? 'Actualizar' : 'Guardar'}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* Tab bar */}
          <View style={[s.tabBar, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
            {(['bloques', 'libreria'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tab, builderTab === tab && { borderBottomWidth: 2, borderBottomColor: Colors.primary }]}
                onPress={() => setBuilderTab(tab)}
              >
                <Text style={[s.tabText, { color: builderTab === tab ? Colors.primary : C.textSub }]}>
                  {tab === 'bloques' ? `📋 Bloques (${blocks.length})` : `💪 Librería`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isTablet ? (
            <View style={[s.builderMain, { backgroundColor: C.bg }]}>
              <View style={[s.panelLeft, { borderRightColor: C.border }]}>
                <BlocksPanel />
              </View>
              <View style={s.panelRight}>
                <LibraryPanel />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: C.bg }}>
              {builderTab === 'bloques' ? <BlocksPanel /> : <LibraryPanel />}
            </View>
          )}
        </View>

      ) : (
        /* ════════════════════════════════════════════════════
           MODO LISTA
        ════════════════════════════════════════════════════ */
        <>
          {/* ── Hero verde con stats ── */}
          <View style={s.hero}>
            {/* Fila título + botones */}
            <View style={s.heroTopRow}>
              <View>
                <Text style={s.heroTitle}>Rutinas</Text>
                <Text style={s.heroSub}>{routines.length} disponibles</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TouchableOpacity
                  style={s.logoutBtn}
                  onPress={async () => { await deleteToken(); router.replace('/auth/login'); }}
                >
                  <Text style={s.logoutText}>Salir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.createBtn} onPress={openBuilder}>
                  <Text style={s.createBtnText}>+ Crear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Stats */}
            <View style={s.heroStats}>
              <View style={s.heroStatItem}>
                <Text style={s.heroStatVal}>{routines.length}</Text>
                <Text style={s.heroStatLbl}>rutinas</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStatItem}>
                <Text style={s.heroStatVal}>{totalExercisesInRoutines}</Text>
                <Text style={s.heroStatLbl}>ejercicios</Text>
              </View>
              <View style={s.heroStatDivider} />
              <View style={s.heroStatItem}>
                <Text style={s.heroStatVal}>{users.length}</Text>
                <Text style={s.heroStatLbl}>usuarios</Text>
              </View>
            </View>

            {/* Buscador */}
            <View style={s.heroSearchRow}>
              <Text style={s.heroSearchIcon}>🔍</Text>
              <TextInput
                style={s.heroSearchInput}
                placeholder="Buscar rutinas..."
                placeholderTextColor={Colors.primaryMid}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* ── Lista ── */}
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ color: '#64748B', marginTop: 12 }}>Cargando rutinas...</Text>
            </View>
          ) : filteredRoutines.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Text style={{ fontSize: 32 }}>🏋️</Text>
              </View>
              <Text style={[s.emptyTitle, { color: '#1A1A1A' }]}>Sin rutinas</Text>
              <Text style={[s.emptySub, { color: '#64748B' }]}>
                Pulsa "+ Crear" para construir{'\n'}tu primera rutina
              </Text>
              <TouchableOpacity style={s.emptyAddBtn} onPress={openBuilder}>
                <Text style={s.emptyAddText}>+ Crear primera rutina</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredRoutines}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: routine }) => {
                const allExercises = (routine.blocks ?? []).flatMap(b => b.exercises ?? []);
                const totalEx = allExercises.length;

                return (
                  <View style={s.routineCard}>
                    {/* Header de la card */}
                    <View style={s.routineCardHeader}>
                      <View style={s.routineAvatar}>
                        <Text style={{ fontSize: 20 }}>🏋️</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.routineCardName}>{routine.name}</Text>
                        <Text style={s.routineCardSub}>
                          {totalEx} ejercicio{totalEx !== 1 ? 's' : ''}
                          {(routine.blocks ?? []).length > 0
                            ? ` · ${(routine.blocks ?? []).length} bloque${(routine.blocks ?? []).length !== 1 ? 's' : ''}`
                            : ''}
                        </Text>
                      </View>
                      <View style={s.routineMenuDots}>
                        <View style={s.menuDot} />
                        <View style={s.menuDot} />
                        <View style={s.menuDot} />
                      </View>
                    </View>

                    {/* Pills de ejercicios */}
                    {totalEx > 0 && (
                      <View style={s.exercisesPreview}>
                        {allExercises.slice(0, 4).map(ex => {
                          const exData = ex.exercise ?? ex;
                          const colors = gc(exData.muscle_group);
                          return (
                            <View key={ex.id} style={[s.exPill, { backgroundColor: colors.bg, borderColor: colors.bg }]}>
                              <Text style={[s.exPillText, { color: colors.text }]}>{exData.name}</Text>
                            </View>
                          );
                        })}
                        {totalEx > 4 && (
                          <View style={[s.exPill, { backgroundColor: Colors.primaryLight, borderColor: Colors.primaryLight }]}>
                            <Text style={[s.exPillText, { color: Colors.primary }]}>+{totalEx - 4} más</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Footer con 4 acciones */}
                    <View style={s.routineCardFooter}>
                      <TouchableOpacity
                        style={[s.footerBtn, s.footerBtnGreen]}
                        onPress={() => openAssignModal(routine)}
                        activeOpacity={0.75}
                      >
                        <Text style={s.footerBtnTextGreen}>👤 Asignar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, s.footerBtnNeutral]}
                        onPress={() => openAssignmentsModal(routine)}
                        activeOpacity={0.75}
                      >
                        <Text style={s.footerBtnTextNeutral}>📅 Ver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, s.footerBtnNeutral]}
                        onPress={() => openEditRoutine(routine)}
                        activeOpacity={0.75}
                      >
                        <Text style={s.footerBtnTextNeutral}>✏️ Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, s.footerBtnRed]}
                        onPress={() => handleDeleteRoutine(routine)}
                        activeOpacity={0.75}
                      >
                        <Text style={s.footerBtnTextRed}>🗑 Borrar</Text>
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
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Hero ──
  hero: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#EAF3DE',
    letterSpacing: 0.2,
  },
  heroSub: {
    fontSize: 13,
    color: '#C0DD97',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C0DD97',
  },
  createBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  createBtnText: {
    color: '#EAF3DE',
    fontSize: 14,
    fontWeight: '700',
  },

  // Stats row
  heroStats: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryDark,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatVal: {
    fontSize: 22,
    fontWeight: '700',
    color: '#EAF3DE',
  },
  heroStatLbl: {
    fontSize: 11,
    color: '#97C459',
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.primary,
  },

  // Search en hero
  heroSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  heroSearchIcon: { fontSize: 14 },
  heroSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#EAF3DE',
  },

  // ── Routine card ──
  routineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  routineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  routineAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  routineCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  routineMenuDots: {
    flexDirection: 'column',
    gap: 3,
    padding: 6,
  },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },

  // Pills ejercicios
  exercisesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  exPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  exPillText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Footer acciones
  routineCardFooter: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#E2E8F0',
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#E2E8F0',
  },
  footerBtnGreen: {
    backgroundColor: Colors.primaryLight,
  },
  footerBtnNeutral: {
    backgroundColor: '#FFFFFF',
  },
  footerBtnRed: {
    backgroundColor: '#FEF2F2',
    borderRightWidth: 0,
  },
  footerBtnTextGreen: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  footerBtnTextNeutral: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  footerBtnTextRed: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },

  // ── Builder ──
  builderTopbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  builderBackBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primaryDark,
  },
  builderTopbarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EAF3DE',
  },
  builderTopbarSub: {
    fontSize: 11,
    color: '#97C459',
    marginTop: 1,
  },
  builderSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  builderMain: { flex: 1, flexDirection: 'row' },
  panelLeft: { flex: 1, borderRightWidth: 0.5 },
  panelRight: { width: 300 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: '500' },

  // ── Empty ──
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  emptyAddText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Blocks builder ──
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderLeftWidth: 4,
    borderBottomWidth: 0.5,
  },
  blockDot: { width: 8, height: 8, borderRadius: 4 },
  blockNameInput: { flex: 1, fontSize: 14, fontWeight: '700', padding: 0 },
  blockCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  blockCountText: { fontSize: 12, fontWeight: '700' },
  blockRemoveBtn: { padding: 6 },
  blockEmptyHint: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderLeftWidth: 4,
    borderBottomWidth: 0.5,
  },
  blockEmptyHintText: { fontSize: 13, fontWeight: '500' },
  exCard: {
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 12,
    borderWidth: 0.5,
    borderLeftWidth: 4,
    padding: 12,
  },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  exCardName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  muscleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  muscleBadgeText: { fontSize: 11, fontWeight: '600' },
  exCardStats: { flexDirection: 'row', gap: 6 },
  exStat: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    padding: 6,
  },
  exStatLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  exStatInput: {
    width: '100%',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    padding: 0,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  addExBtnText: { fontSize: 13, fontWeight: '500' },
  addAnotherBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addAnotherBlockText: { fontSize: 14, fontWeight: '600' },

  // ── Library ──
  libBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  libBannerText: { fontSize: 13, fontWeight: '500' },
  activeBlockDot: { width: 8, height: 8, borderRadius: 4 },
  libSearchRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
  },
  libSearchInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
  },
  libFilters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  libChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  libChipText: { fontSize: 12, fontWeight: '500' },
  libCount: { fontSize: 11, padding: 6, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  libItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  libThumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  libTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  libTagText: { fontSize: 10, fontWeight: '600' },
  libDesc: { fontSize: 11, marginTop: 3 },
  libAddCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 0.5,
    padding: 24,
    paddingBottom: 44,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalTitleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  modalClose: { padding: 4 },
  modalSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    marginBottom: 4,
  },
  noteInput: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 4,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  btnCancelText: { fontSize: 14, fontWeight: '500' },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Assign modal
  assignBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  assignBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
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
  assignName: { fontSize: 14, fontWeight: '600' },
  assignSub: { fontSize: 12, marginTop: 2 },
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
    padding: 12,
    borderRadius: 10,
    borderBottomWidth: 0.5,
    marginBottom: 4,
  },
  deleteAssignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
});