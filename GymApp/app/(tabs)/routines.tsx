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
      console.log(JSON.stringify(payload, null, 2));
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

  // ─── Derivados ────────────────────────────────────────────────────────────────
  const filteredRoutines = routines.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredLibrary = exercises.filter(e => {
    const ms = e.name.toLowerCase().includes(librarySearch.toLowerCase());
    const mg = libraryFilter === 'Todos' || e.muscle_group === libraryFilter;
    return ms && mg;
  });
  const selectedBlock = blocks.find(b => b.localId === selectedBlockId) ?? null;
  const totalExercises = blocks.reduce((s, b) => s + b.exercises.length, 0);

  // ─── Panel Bloques ────────────────────────────────────────────────────────────
  const BlocksPanel = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
      {blocks.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>📋</Text>
          <Text style={[s.emptyTitle, { color: C.text }]}>Sin bloques todavía</Text>
          <Text style={[s.emptySub, { color: C.textSub }]}>Crea tu primer bloque (ej: Calentamiento, Fuerza…)</Text>
          <TouchableOpacity style={[s.emptyAddBtn, { backgroundColor: Colors.primary }]} onPress={addBlock}>
            <Text style={s.emptyAddText}>+ Añadir primer bloque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {blocks.map(block => (
            <View key={block.localId}>
              <TouchableOpacity
                onPress={() => { setSelectedBlockId(block.localId); toggleCollapse(block.localId); }}
                style={[s.blockHead, { borderLeftColor: block.color, backgroundColor: selectedBlockId === block.localId ? block.color + '18' : 'transparent', borderBottomColor: C.border }]}
              >
                <View style={[s.blockDot, { backgroundColor: block.color }]} />
                <TextInput
                  style={[s.blockNameInput, { color: C.text }]}
                  value={block.name}
                  onChangeText={v => updateBlockName(block.localId, v)}
                  onFocus={() => setSelectedBlockId(block.localId)}
                />
                <Text style={[s.blockCount, { color: C.textSub }]}>{block.exercises.length} ej.</Text>
                <Text style={{ color: C.textSub, fontSize: 16 }}>{block.collapsed ? '›' : '⌃'}</Text>
                <TouchableOpacity onPress={() => removeBlock(block.localId)} style={{ padding: 6 }}>
                  <Text style={{ color: C.error, fontSize: 15 }}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {!block.collapsed && (
                <>
                  {block.exercises.length === 0 ? (
                    <TouchableOpacity
                      style={[s.blockEmptyHint, { borderLeftColor: block.color + '66', borderBottomColor: C.border }]}
                      onPress={() => { setSelectedBlockId(block.localId); setBuilderTab('libreria'); }}
                    >
                      <Text style={[s.blockEmptyHintText, { color: block.color }]}>+ Toca para añadir ejercicios desde la librería</Text>
                    </TouchableOpacity>
                  ) : (
                    block.exercises.map(ex => {
                      const colors = gc(ex.muscle_group);
                      return (
                        <View key={ex.localId} style={[s.exCard, { borderLeftColor: block.color, backgroundColor: C.surface, borderColor: C.border }]}>
                          <View style={s.exCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.exCardName, { color: C.text }]}>{ex.name}</Text>
                              <View style={[s.muscleBadge, { backgroundColor: colors.bg }]}>
                                <Text style={[s.muscleBadgeText, { color: colors.text }]}>{ex.muscle_group}</Text>
                              </View>
                            </View>
                            <TouchableOpacity onPress={() => removeExercise(block.localId, ex.localId)} style={{ padding: 4 }}>
                              <Text style={{ color: C.error, fontSize: 15 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={s.exCardStats}>
                            {(['series', 'objetivo', 'descanso'] as const).map(field => (
                              <View key={field} style={s.exStat}>
                                <Text style={[s.exStatLabel, { color: C.textSub }]}>{field.toUpperCase()}</Text>
                                <TextInput
                                  style={[s.exStatInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
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
                      style={[s.addExBtn, { borderColor: block.color + '55', borderLeftColor: block.color }]}
                      onPress={() => { setSelectedBlockId(block.localId); setBuilderTab('libreria'); }}
                    >
                      <Text style={[s.addExBtnText, { color: block.color }]}>+ Añadir ejercicio</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ))}
          <TouchableOpacity style={[s.addAnotherBlock, { borderColor: C.border, backgroundColor: C.surface }]} onPress={addBlock}>
            <Text style={[s.addAnotherBlockText, { color: C.textSub }]}>+ Añadir otro bloque</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  // ─── Panel Librería ───────────────────────────────────────────────────────────
  const LibraryPanel = () => (
    <View style={{ flex: 1 }}>
      <View style={[s.libBanner, { backgroundColor: selectedBlock ? selectedBlock.color + '15' : '#F59E0B15', borderBottomColor: selectedBlock ? selectedBlock.color + '44' : '#F59E0B44' }]}>
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
            style={[s.libChip, { backgroundColor: libraryFilter === g ? Colors.primary : C.surface, borderColor: libraryFilter === g ? Colors.primary : C.border }]}
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
                style={[s.libItem, { borderBottomColor: C.border, backgroundColor: C.bg, opacity: !selectedBlock ? 0.4 : 1 }]}
                onPress={() => addFromLibrary(item)}
                activeOpacity={0.7}
              >
                <View style={[s.libThumb, { backgroundColor: colors.bg, borderColor: colors.bg }]}>
                  <Text style={{ fontSize: 16, color: colors.accent }}>💪</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.libName, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.libTag, { backgroundColor: colors.bg, borderColor: colors.bg }]}>
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
                  <View style={[s.libAddCircle, { borderColor: selectedBlock ? selectedBlock.color : C.border, backgroundColor: selectedBlock ? selectedBlock.color + '15' : 'transparent' }]}>
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: C.text }]}>Nueva rutina</Text>
              <TouchableOpacity onPress={() => setShowNameModal(false)}>
                <Text style={{ color: C.textSub, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: C.textSub }]}>Dale un nombre a tu rutina antes de empezar</Text>
            <TextInput
              style={[s.nameInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              placeholder="Ej: Fuerza lunes, Full body..."
              placeholderTextColor={C.textSub}
              value={pendingRoutineName}
              onChangeText={setPendingRoutineName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmNameAndOpenBuilder}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: C.border }]} onPress={() => setShowNameModal(false)}>
                <Text style={[s.btnCancelText, { color: C.textSub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { marginTop: 0, flex: 1, opacity: pendingRoutineName.trim() ? 1 : 0.5 }]}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: C.text }]}>Asignar rutina</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Text style={{ color: C.textSub, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={[s.assignBadge, { backgroundColor: Colors.primaryLight }]}>
              <Text style={[s.assignBadgeText, { color: Colors.primary }]} numberOfLines={1}>💪 {selectedRoutine?.name}</Text>
            </View>

            <Text style={[s.modalSub, { color: C.textSub }]}>Selecciona el usuario que recibirá esta rutina</Text>

            {users.length === 0 ? (
              <Text style={{ color: C.textSub, textAlign: 'center', marginVertical: 20, fontSize: 13 }}>
                No hay otros usuarios disponibles.{'\n'}Solo admins pueden asignar rutinas.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 260 }}>
                {users.map(user => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <TouchableOpacity
                      key={user.id}
                      style={[s.assignRow, { borderColor: isSelected ? Colors.primary : C.border, backgroundColor: isSelected ? Colors.primaryLight : 'transparent' }]}
                      onPress={() => setSelectedUserIds(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id])}
                    >
                      <View style={[s.userAvatar, { backgroundColor: Colors.primaryLight }]}>
                        <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 14 }}>
                          {user.name?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.assignName, { color: C.text }]}>{user.name || 'Sin nombre'}</Text>
                        <Text style={[s.assignSub, { color: C.textSub }]}>{user.email || 'Sin email'}</Text>
                      </View>
                      {isSelected && (
                        <View style={[s.checkCircle, { backgroundColor: Colors.primary }]}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              placeholder="Nota opcional para el usuario..."
              placeholderTextColor={C.textSub}
              value={assignNote} onChangeText={setAssignNote}
              multiline numberOfLines={2}
            />
            <TextInput
              style={[s.noteInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
              placeholder="Fecha (YYYY-MM-DD)"
              placeholderTextColor={C.textSub}
              value={assignDate}
              onChangeText={setAssignDate}
            />

            <TouchableOpacity
              style={[s.btnPrimary, { opacity: selectedUserIds.length > 0 && assignDate && !assigning ? 1 : 0.5 }]}
              onPress={confirmAssign}
              disabled={selectedUserIds.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(assignDate) || assigning}
            >
              {assigning ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Asignar rutina</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal: ver asignaciones ── */}
      <Modal visible={showAssignmentsModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[s.modalTitle, { color: C.text }]}>Asignaciones</Text>
              <TouchableOpacity onPress={() => setShowAssignmentsModal(false)}>
                <Text style={{ color: C.textSub, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: C.textSub, marginBottom: 10 }}>{selectedRoutine?.name}</Text>
            {loadingAssignments ? (
              <ActivityIndicator color={Colors.primary} />
            ) : routineAssignments.length === 0 ? (
              <Text style={{ color: C.textSub }}>No hay asignaciones</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {routineAssignments.map(a => (
                  <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: C.border }}>
                    <View>
                      <Text style={{ color: C.text }}>Usuario ID: {a.assigned_to_id}</Text>
                      <Text style={{ color: C.textSub, fontSize: 12 }}>{a.date}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteAssignment(a.id)}>
                      <Text style={{ color: C.error }}>Eliminar</Text>
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
          <View style={[s.topbar, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
            <TouchableOpacity
              style={[s.topBtn, { borderColor: C.border }]}
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
              <Text style={{ color: C.textSub, fontSize: 13 }}>← Volver</Text>
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[s.topbarTitle, { color: C.text }]} numberOfLines={1}>{routineName}</Text>
              <Text style={{ fontSize: 11, color: C.textSub }}>{blocks.length} bloques · {totalExercises} ejercicios</Text>
            </View>

            <TouchableOpacity
              style={[s.topBtnPrimary, { backgroundColor: saving ? C.border : Colors.primary }]}
              onPress={saveRoutine}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                    {editingRoutineId ? 'Actualizar' : 'Guardar'}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* Tab bar: Bloques / Librería */}
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

          {/* Contenido del builder */}
          {isTablet ? (
            // Tablet: dos paneles lado a lado
            <View style={[s.builderMain, { backgroundColor: C.bg }]}>
              <View style={[s.panelLeft, { borderRightColor: C.border }]}>
                <BlocksPanel />
              </View>
              <View style={s.panelRight}>
                <LibraryPanel />
              </View>
            </View>
          ) : (
            // Mobile: tabs
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
          {/* Header lista */}
          <View style={[s.listHeader, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
            <View>
              <Text style={[s.listTitle, { color: C.text }]}>Rutinas</Text>
              <Text style={{ fontSize: 14, color: C.textSub }}>{filteredRoutines.length} disponibles</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TouchableOpacity
                style={[s.logoutBtn, { backgroundColor: Colors.primaryLight }]}
                onPress={async () => { await deleteToken(); router.replace('/auth/login'); }}
              >
                <Text style={[s.logoutText, { color: Colors.primary }]}>Salir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.createBtn, { backgroundColor: Colors.primary }]} onPress={openBuilder}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>+ Crear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Buscador */}
          <View style={[s.searchRow, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
            <TextInput
              style={[s.searchInput, { color: C.text, borderColor: C.border, backgroundColor: C.bg }]}
              placeholder="Buscar rutinas..."
              placeholderTextColor={C.textSub}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Contenido lista */}
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ color: C.textSub, marginTop: 12 }}>Cargando rutinas...</Text>
            </View>
          ) : filteredRoutines.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 56 }}>🏋️</Text>
              <Text style={[s.emptyTitle, { color: C.text }]}>Sin rutinas</Text>
              <Text style={[s.emptySub, { color: C.textSub }]}>Pulsa "+ Crear" para construir tu primera rutina</Text>
              <TouchableOpacity style={[s.emptyAddBtn, { backgroundColor: Colors.primary, marginTop: 8 }]} onPress={openBuilder}>
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
                  <View style={[s.routineCard, { backgroundColor: C.card, borderColor: C.border }]}>

                    <View style={s.routineCardHeader}>
                      <View style={[s.routineIconBox, { backgroundColor: Colors.primaryLight }]}>
                        <Text style={{ fontSize: 18 }}>🏋️</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.routineCardName, { color: C.text }]}>{routine.name}</Text>
                        <Text style={[s.routineCardSub, { color: C.textSub }]}>
                          {totalEx} ejercicio{totalEx !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {totalEx > 0 && (
                      <View style={s.exercisesPreview}>
                        {allExercises.slice(0, 4).map(ex => {
                          const exData = ex.exercise ?? ex;
                          const colors = gc(exData.muscle_group);
                          return (
                            <View key={ex.id} style={[s.exPill, { backgroundColor: colors.bg }]}>
                              <Text style={[s.exPillText, { color: colors.text }]}>{exData.name}</Text>
                            </View>
                          );
                        })}
                        {totalEx > 4 && (
                          <View style={[s.exPill, { backgroundColor: Colors.primaryLight }]}>
                            <Text style={[s.exPillText, { color: Colors.primary }]}>+{totalEx - 4} más</Text>
                          </View>
                        )}
                      </View>
                    )}

                    <View style={[s.routineCardFooter, { borderTopColor: C.border }]}>
                      <TouchableOpacity style={[s.footerBtn, { borderColor: C.border }]} onPress={() => openAssignModal(routine)}>
                        <Text style={[s.footerBtnText, { color: C.text }]}>👤 Asignar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.footerBtn, { borderColor: C.border }]} onPress={() => openAssignmentsModal(routine)}>
                        <Text style={[s.footerBtnText, { color: C.text }]}>📅 Ver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.footerBtn, { borderColor: C.border }]} onPress={() => openEditRoutine(routine)}>
                        <Text style={[s.footerBtnText, { color: C.text }]}>✏️ Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.footerBtn, { borderColor: C.error + '44', backgroundColor: C.error + '08' }]}
                        onPress={async () => {
                          Alert.alert('Eliminar rutina', `¿Eliminar "${routine.name}"?`, [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Eliminar', style: 'destructive', onPress: async () => {
                                try {
                                  await deleteRoutine(routine.id);
                                  await reload();
                                  Alert.alert('✓ Eliminada');
                                } catch (err: any) {
                                  Alert.alert('Error', err.message);
                                }
                              }
                            }
                          ]);
                        }}
                      >
                        <Text style={[s.footerBtnText, { color: C.error }]}>🗑 Borrar</Text>
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
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 0.5 },
  listTitle: { fontSize: 26, fontWeight: '700', marginBottom: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  logoutText: { fontSize: 13, fontWeight: '600' },
  createBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  searchRow: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5 },
  searchInput: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  // Routine card
  routineCard: { borderRadius: 16, borderWidth: 0.5, padding: 16, overflow: 'hidden' },
  routineCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  routineIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routineCardName: { fontSize: 16, fontWeight: '700' },
  routineCardSub: { fontSize: 12, marginTop: 2 },
  savedBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  savedBadgeText: { fontSize: 11, fontWeight: '600' },
  exercisesPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  exPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5 },
  exPillText: { fontSize: 11, fontWeight: '500' },
  routineCardFooter: { flexDirection: 'row', gap: 6, borderTopWidth: 0.5, paddingTop: 12 },
  footerBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 0.5, alignItems: 'center' },
  footerBtnText: { fontSize: 11, fontWeight: '600' },
  // Builder
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  topbarTitle: { fontSize: 15, fontWeight: '600' },
  topBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5 },
  topBtnPrimary: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  builderMain: { flex: 1, flexDirection: 'row' },
  panelLeft: { flex: 1, borderRightWidth: 0.5 },
  panelRight: { width: 300 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: '500' },
  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  emptyAddText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Blocks
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderLeftWidth: 4, borderBottomWidth: 0.5 },
  blockDot: { width: 8, height: 8, borderRadius: 4 },
  blockNameInput: { flex: 1, fontSize: 14, fontWeight: '700', padding: 0 },
  blockCount: { fontSize: 12 },
  blockEmptyHint: { paddingHorizontal: 20, paddingVertical: 14, borderLeftWidth: 4, borderBottomWidth: 0.5 },
  blockEmptyHintText: { fontSize: 13, fontWeight: '500' },
  exCard: { marginHorizontal: 12, marginVertical: 5, borderRadius: 12, borderWidth: 0.5, borderLeftWidth: 4, padding: 12 },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  exCardName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  muscleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  muscleBadgeText: { fontSize: 11, fontWeight: '600' },
  exCardStats: { flexDirection: 'row', gap: 8 },
  exStat: { flex: 1, alignItems: 'center', gap: 4 },
  exStatLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  exStatInput: { width: '100%', fontSize: 13, fontWeight: '600', borderWidth: 0.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 5, textAlign: 'center' },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderLeftWidth: 4 },
  addExBtnText: { fontSize: 13, fontWeight: '500' },
  addAnotherBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 14, borderRadius: 10, borderWidth: 1 },
  addAnotherBlockText: { fontSize: 14, fontWeight: '500' },
  // Library
  libBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  libBannerText: { fontSize: 13, fontWeight: '500' },
  activeBlockDot: { width: 8, height: 8, borderRadius: 4 },
  libSearchRow: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 0.5 },
  libSearchInput: { borderWidth: 0.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  libFilters: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  libChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  libChipText: { fontSize: 12, fontWeight: '500' },
  libCount: { fontSize: 11, padding: 6, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  libItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  libThumb: { width: 40, height: 40, borderRadius: 10, borderWidth: 0.5, justifyContent: 'center', alignItems: 'center' },
  libName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  libTag: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 0.5 },
  libTagText: { fontSize: 10, fontWeight: '600' },
  libDesc: { fontSize: 11, marginTop: 3 },
  libAddCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 0.5, padding: 24, paddingBottom: 44 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  nameInput: { borderWidth: 0.5, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 4 },
  noteInput: { borderWidth: 0.5, borderRadius: 12, padding: 12, fontSize: 14, marginTop: 12, marginBottom: 4, minHeight: 60, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  btnCancel: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 0.5 },
  btnCancelText: { fontSize: 14 },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  assignBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  assignBadgeText: { fontSize: 13, fontWeight: '600' },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  assignName: { fontSize: 14, fontWeight: '600' },
  assignSub: { fontSize: 12, marginTop: 2 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
});