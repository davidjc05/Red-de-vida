import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useColorScheme, Dimensions, TextInput, Modal,
  FlatList, Alert, ActivityIndicator, SafeAreaView,
  ImageBackground, Animated, Platform, KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import {
  getExercises, createRoutine, assignRoutine, getUsers, deleteToken, deleteRoutine,
  getAssignmentsByRoutine, deleteAssignment, updateRoutineFull,
} from '../../services/api';
import { useRoutines, type Routine, type Exercise } from '../../hooks/useRoutines';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type BlockExercise = {
  localId: string;
  exerciseId: number;
  name: string;
  muscle_group: string;
  series: string;
  objetivo: string;
  descanso: string;
};

type Block = {
  localId: string;
  name: string;
  color: string;
  collapsed: boolean;
  exercises: BlockExercise[];
};

type User = { id: number; name: string; email: string; role: string };

type Assignment = {
  id: number;
  assigned_to_id: number;
  date: string;
  note?: string;
};

type AppMode = 'list' | 'builder';
type BuilderTab = 'bloques' | 'libreria';

// ─── Constantes ───────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const IS_TABLET = width > 768;

const BLOCK_COLORS = ['#3B6D11', '#10B981', '#6366F1', '#F59E0B', '#EC4899', '#14B8A6'];
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

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const gc = (g: string) => GROUP_COLORS[g] ?? GROUP_COLORS.default;

// ─── Hook: tema de colores ─────────────────────────────────────────────────────
function useTheme(isDark: boolean) {
  return useMemo(() => ({
    bg:       isDark ? '#0F172A' : '#F0F4ED',
    surface:  isDark ? '#1E293B' : '#FFFFFF',
    card:     isDark ? '#1E293B' : '#FFFFFF',
    text:     isDark ? '#F1F5F9' : '#1A1A1A',
    textSub:  isDark ? '#94A3B8' : '#64748B',
    border:   isDark ? '#334155' : '#E2E8F0',
    error:    '#EF4444',
    success:  '#22C55E',
  }), [isDark]);
}

// ─── Hook: estado del builder ─────────────────────────────────────────────────
function useBuilder() {
  const [routineName, setRoutineName] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);

  // Auto-deselect removed blocks
  useEffect(() => {
    if (selectedBlockId && !blocks.find(b => b.localId === selectedBlockId)) {
      setSelectedBlockId(blocks[blocks.length - 1]?.localId ?? null);
    }
  }, [blocks, selectedBlockId]);

  const reset = useCallback(() => {
    setRoutineName('');
    setBlocks([]);
    setSelectedBlockId(null);
    setEditingRoutineId(null);
  }, []);

  const loadFromRoutine = useCallback((routine: Routine) => {
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name);
    const mapped: Block[] = (routine.blocks ?? []).map((b, i) => ({
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
      })),
    }));
    setBlocks(mapped);
    setSelectedBlockId(mapped[0]?.localId ?? null);
  }, []);

  const addBlock = useCallback(() => {
    setBlocks(prev => {
      const color = BLOCK_COLORS[prev.length % BLOCK_COLORS.length];
      const nb: Block = {
        localId: uid(),
        name: `Bloque ${prev.length + 1}`,
        color,
        collapsed: false,
        exercises: [],
      };
      setSelectedBlockId(nb.localId);
      return [...prev, nb];
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(p => p.filter(b => b.localId !== id));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setBlocks(p => p.map(b => b.localId === id ? { ...b, collapsed: !b.collapsed } : b));
  }, []);

  const updateBlockName = useCallback((id: string, v: string) => {
    setBlocks(p => p.map(b => b.localId === id ? { ...b, name: v } : b));
  }, []);

  const addExerciseToBlock = useCallback((blockId: string, ex: Exercise) => {
    setBlocks(prev => prev.map(b => {
      if (b.localId !== blockId) return b;
      if (b.exercises.some(e => e.exerciseId === ex.id)) return b; // ya existe, silencioso
      const newEx: BlockExercise = {
        localId: uid(),
        exerciseId: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        series: '3',
        objetivo: '10 reps',
        descanso: '60s',
      };
      return { ...b, collapsed: false, exercises: [...b.exercises, newEx] };
    }));
  }, []);

  const updateExercise = useCallback((bId: string, eId: string, field: keyof BlockExercise, v: string) => {
    setBlocks(p => p.map(b =>
      b.localId !== bId ? b : {
        ...b,
        exercises: b.exercises.map(e => e.localId === eId ? { ...e, [field]: v } : e),
      }
    ));
  }, []);

  const removeExercise = useCallback((bId: string, eId: string) => {
    setBlocks(p => p.map(b =>
      b.localId !== bId ? b : { ...b, exercises: b.exercises.filter(e => e.localId !== eId) }
    ));
  }, []);

  const selectedBlock = useMemo(
    () => blocks.find(b => b.localId === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );

  const totalExercises = useMemo(
    () => blocks.reduce((s, b) => s + b.exercises.length, 0),
    [blocks]
  );

  return {
    routineName, setRoutineName,
    blocks, setBlocks,
    selectedBlockId, setSelectedBlockId,
    editingRoutineId,
    selectedBlock,
    totalExercises,
    reset, loadFromRoutine, addBlock, removeBlock,
    toggleCollapse, updateBlockName,
    addExerciseToBlock, updateExercise, removeExercise,
  };
}

// ─── Componente: ExerciseCard ─────────────────────────────────────────────────
type ExerciseCardProps = {
  ex: BlockExercise;
  block: Block;
  C: ReturnType<typeof useTheme>;
  onUpdate: (field: keyof BlockExercise, v: string) => void;
  onRemove: () => void;
};

const ExerciseCard = React.memo(({ ex, block, C, onUpdate, onRemove }: ExerciseCardProps) => {
  const colors = gc(ex.muscle_group);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <View style={[s.exCard, {
        borderLeftColor: block.color,
        backgroundColor: C.surface,
        borderColor: C.border,
      }]}>
        <View style={s.exCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.exCardName, { color: C.text }]}>{ex.name}</Text>
            <View style={[s.muscleBadge, { backgroundColor: colors.bg }]}>
              <Text style={[s.muscleBadgeText, { color: colors.text }]}>{ex.muscle_group}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onRemove}
            style={s.exRemoveBtn}
            accessibilityLabel={`Eliminar ${ex.name}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
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
                onChangeText={v => onUpdate(field, v)}
                keyboardType={field === 'series' ? 'numeric' : 'default'}
                accessibilityLabel={`${field} de ${ex.name}`}
              />
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
});

// ─── Componente: LibraryItem ──────────────────────────────────────────────────
type LibraryItemProps = {
  item: Exercise;
  isAdded: boolean;
  isDisabled: boolean;
  blockColor: string | null;
  C: ReturnType<typeof useTheme>;
  onPress: () => void;
};

const LibraryItem = React.memo(({ item, isAdded, isDisabled, blockColor, C, onPress }: LibraryItemProps) => {
  const colors = gc(item.muscle_group);
  return (
    <TouchableOpacity
      style={[s.libItem, { borderBottomColor: C.border, backgroundColor: C.surface, opacity: isDisabled ? 0.4 : 1 }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={isDisabled}
      accessibilityLabel={`Añadir ${item.name} al bloque`}
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
      {isAdded ? (
        <View style={[s.libAddCircle, { borderColor: Colors.primary, backgroundColor: Colors.primaryLight }]}>
          <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '700' }}>✓</Text>
        </View>
      ) : (
        <View style={[s.libAddCircle, {
          borderColor: blockColor ?? C.border,
          backgroundColor: blockColor ? blockColor + '15' : 'transparent',
        }]}>
          <Text style={{ color: blockColor ?? C.textSub, fontSize: 18 }}>+</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─── Componente: RoutineCard ──────────────────────────────────────────────────
type RoutineCardProps = {
  routine: Routine;
  onAssign: () => void;
  onViewAssignments: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const RoutineCard = React.memo(({ routine, onAssign, onViewAssignments, onEdit, onDelete }: RoutineCardProps) => {
  const allExercises = useMemo(
    () => (routine.blocks ?? []).flatMap(b => b.exercises ?? []),
    [routine.blocks]
  );
  const totalEx = allExercises.length;
  const totalBlocks = (routine.blocks ?? []).length;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 40 }).start();
  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={[s.routineCard, { transform: [{ scale: scaleAnim }] }]}>
      <ImageBackground
        source={require('../../assets/images/fondoCards.png')}
        style={s.cardBg}
        imageStyle={s.cardBgImage}
        resizeMode="cover"
      >
        {/* Menú tres puntos — placeholder para futura acción */}
        <TouchableOpacity
          style={s.menuDotsBtn}
          activeOpacity={0.6}
          accessibilityLabel="Más opciones"
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={s.menuDot} />
          <View style={s.menuDot} />
          <View style={s.menuDot} />
        </TouchableOpacity>

        {/* Indicadores de bloques */}
        {totalBlocks > 0 && (
          <View style={s.blockIndicators}>
            {(routine.blocks ?? []).slice(0, 6).map((_, i) => (
              <View
                key={i}
                style={[s.blockIndicatorDot, { backgroundColor: BLOCK_COLORS[i % BLOCK_COLORS.length] }]}
              />
            ))}
            {totalBlocks > 6 && (
              <Text style={s.blockIndicatorMore}>+{totalBlocks - 6}</Text>
            )}
          </View>
        )}

        <View style={s.cardBody}>
          <Text style={s.routineCardName}>{routine.name}</Text>
          <Text style={s.routineCardSub}>
            {totalEx} ejercicio{totalEx !== 1 ? 's' : ''}
            {totalBlocks > 0 ? ` · ${totalBlocks} bloque${totalBlocks !== 1 ? 's' : ''}` : ''}
          </Text>

          {totalEx > 0 && (
            <View style={s.exercisesPreview}>
              {allExercises.slice(0, 4).map(ex => {
                const exData = ex.exercise ?? ex;
                const colors = gc(exData.muscle_group);
                return (
                  <View key={ex.id ?? exData.id} style={[s.exPill, { backgroundColor: colors.bg }]}>
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
        </View>

        <View style={[s.routineCardFooter, { borderTopColor: 'rgba(0,0,0,0.06)' }]}>
          <FooterAction icon="👤" label="Asignar" onPress={onAssign} variant="green" />
          <View style={s.footerDivider} />
          <FooterAction icon="📅" label="Ver" onPress={onViewAssignments} variant="neutral" />
          <View style={s.footerDivider} />
          <FooterAction icon="✏️" label="Editar" onPress={onEdit} variant="neutral" />
          <View style={s.footerDivider} />
          <FooterAction icon="🗑" label="Borrar" onPress={onDelete} variant="red" />
        </View>
      </ImageBackground>
    </Animated.View>
  );
});

// ─── Componente auxiliar: FooterAction ───────────────────────────────────────
type FooterActionProps = {
  icon: string;
  label: string;
  onPress: () => void;
  variant: 'green' | 'neutral' | 'red';
};

const FOOTER_COLORS = {
  green:   Colors.primary,
  neutral: '#475569',
  red:     '#EF4444',
};

const FooterAction = React.memo(({ icon, label, onPress, variant }: FooterActionProps) => {
  const color = FOOTER_COLORS[variant];
  return (
    <TouchableOpacity
      style={s.footerBtn}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={label}
    >
      <Text style={{ fontSize: 13 }}>{icon}</Text>
      <Text style={[s.footerBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
});

// ─── Componente: EmptyState ───────────────────────────────────────────────────
const EmptyState = React.memo(({ onPress }: { onPress: () => void }) => (
  <View style={s.empty}>
    <View style={s.emptyIcon}>
      <Text style={{ fontSize: 32 }}>🏋️</Text>
    </View>
    <Text style={s.emptyTitle}>Sin rutinas</Text>
    <Text style={s.emptySub}>Pulsa "+ Crear" para construir{'\n'}tu primera rutina</Text>
    <TouchableOpacity style={s.emptyAddBtn} onPress={onPress}>
      <Text style={s.emptyAddText}>+ Crear primera rutina</Text>
    </TouchableOpacity>
  </View>
));

// ─── Componente: StatBadge ────────────────────────────────────────────────────
const StatBadge = ({ icon, value, label }: { icon: string; value: number; label: string }) => (
  <View style={s.heroStatItem}>
    <View style={s.heroStatIconBox}>
      <Text style={s.heroStatIconText}>{icon}</Text>
    </View>
    <View style={s.heroStatTexts}>
      <Text style={s.heroStatVal}>{value}</Text>
      <Text style={s.heroStatLbl}>{label}</Text>
    </View>
  </View>
);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RoutinesScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const C = useTheme(isDark);
  const { routines, loading, reload } = useRoutines();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [mode, setMode] = useState<AppMode>('list');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const builder = useBuilder();
  const [builderTab, setBuilderTab] = useState<BuilderTab>('bloques');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('Todos');
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingRoutineName, setPendingRoutineName] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [assignDate, setAssignDate] = useState('');
  const [assignNote, setAssignNote] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [showAssignmentsModal, setShowAssignmentsModal] = useState(false);
  const [routineAssignments, setRoutineAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    getExercises().then(setExercises).catch(() => {});
    getUsers().then(setUsers).catch(() => {});
  }, []);

  // ─── Derivados ────────────────────────────────────────────────────────────
  const filteredRoutines = useMemo(
    () => routines.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [routines, searchQuery]
  );

  const filteredLibrary = useMemo(() => exercises.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(librarySearch.toLowerCase());
    const matchGroup = libraryFilter === 'Todos' || e.muscle_group === libraryFilter;
    return matchSearch && matchGroup;
  }), [exercises, librarySearch, libraryFilter]);

  const totalExercisesInRoutines = useMemo(
    () => routines.reduce((sum, r) =>
      sum + (r.blocks ?? []).flatMap(b => b.exercises ?? []).length, 0),
    [routines]
  );

  // ─── Builder: abrir / guardar ─────────────────────────────────────────────
  const openBuilder = useCallback(() => {
    setPendingRoutineName('');
    setShowNameModal(true);
  }, []);

  const confirmNameAndOpenBuilder = useCallback(() => {
    if (!pendingRoutineName.trim()) {
      Alert.alert('Error', 'Escribe un nombre para la rutina');
      return;
    }
    builder.setRoutineName(pendingRoutineName.trim());
    setShowNameModal(false);
    setBuilderTab('bloques');
    setMode('builder');
  }, [pendingRoutineName, builder]);

  const openEditRoutine = useCallback((routine: Routine) => {
    builder.loadFromRoutine(routine);
    setBuilderTab('bloques');
    setMode('builder');
  }, [builder]);

  const exitBuilder = useCallback(() => {
    Alert.alert(
      'Salir del editor',
      '¿Seguro? Los cambios no guardados se perderán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => { setMode('list'); builder.reset(); } },
      ]
    );
  }, [builder]);

  const saveRoutine = useCallback(async () => {
    if (!builder.routineName.trim()) { Alert.alert('Error', 'La rutina necesita un nombre'); return; }
    if (builder.blocks.length === 0) { Alert.alert('Error', 'Añade al menos un bloque'); return; }

    setSaving(true);
    try {
      const payload = {
        name: builder.routineName.trim(),
        blocks: builder.blocks.map((b, blockIndex) => ({
          name: b.name,
          order: blockIndex,
          exercises: b.exercises.map((e, exIndex) => ({
            exerciseId: e.exerciseId,
            order: exIndex,
          })),
        })),
      };

      if (builder.editingRoutineId) {
        await updateRoutineFull(builder.editingRoutineId, payload.name, payload.blocks);
        Alert.alert('✓ Rutina actualizada');
      } else {
        const routine = await createRoutine(payload.name);
        await updateRoutineFull(routine.id, payload.name, payload.blocks);
        Alert.alert('✓ Rutina creada');
      }

      await reload();
      setMode('list');
      builder.reset();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }, [builder, reload]);

  // ─── Asignar ──────────────────────────────────────────────────────────────
  const openAssignModal = useCallback((routine: Routine) => {
    setSelectedRoutine(routine);
    setSelectedUserIds([]);
    setAssignDate('');
    setAssignNote('');
    setShowAssignModal(true);
  }, []);

  const confirmAssign = useCallback(async () => {
    if (!selectedRoutine || selectedUserIds.length === 0 || !assignDate) {
      Alert.alert('Faltan datos', 'Selecciona al menos un usuario y una fecha.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(assignDate)) {
      Alert.alert('Fecha inválida', 'Usa el formato AAAA-MM-DD');
      return;
    }
    const formattedDate = new Date(assignDate).toISOString().split('T')[0];
    setAssigning(true);
    try {
      await assignRoutine(selectedRoutine.id, selectedUserIds, formattedDate, assignNote || undefined);
      setShowAssignModal(false);
      Alert.alert('✓ Asignadas correctamente');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setAssigning(false);
    }
  }, [selectedRoutine, selectedUserIds, assignDate, assignNote]);

  const toggleUserId = useCallback((id: number) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
    );
  }, []);

  const openAssignmentsModal = useCallback(async (routine: Routine) => {
    setSelectedRoutine(routine);
    setShowAssignmentsModal(true);
    setLoadingAssignments(true);
    try {
      const data = await getAssignmentsByRoutine(routine.id);
      setRoutineAssignments(data);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const handleDeleteAssignment = useCallback(async (id: number) => {
    Alert.alert('Eliminar asignación', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await deleteAssignment(id);
            setRoutineAssignments(prev => prev.filter(a => a.id !== id));
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Error desconocido');
          }
        },
      },
    ]);
  }, []);

  const handleDeleteRoutine = useCallback((routine: Routine) => {
    Alert.alert(
      'Eliminar rutina',
      `¿Eliminar "${routine.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              await deleteRoutine(routine.id);
              await reload();
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Error desconocido');
            }
          },
        },
      ]
    );
  }, [reload]);

  // ─── Subcomponentes (closures con acceso al estado local) ─────────────────
  const BlocksPanel = useCallback(() => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {builder.blocks.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}><Text style={{ fontSize: 32 }}>📋</Text></View>
          <Text style={[s.emptyTitle, { color: C.text }]}>Sin bloques todavía</Text>
          <Text style={[s.emptySub, { color: C.textSub }]}>Crea tu primer bloque{'\n'}(ej: Calentamiento, Fuerza…)</Text>
          <TouchableOpacity style={s.emptyAddBtn} onPress={builder.addBlock}>
            <Text style={s.emptyAddText}>+ Añadir primer bloque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {builder.blocks.map(block => (
            <View key={block.localId}>
              {/* Cabecera del bloque */}
              <TouchableOpacity
                onPress={() => {
                  builder.setSelectedBlockId(block.localId);
                  builder.toggleCollapse(block.localId);
                }}
                style={[s.blockHead, {
                  borderLeftColor: block.color,
                  backgroundColor: builder.selectedBlockId === block.localId
                    ? block.color + '18'
                    : C.surface,
                  borderBottomColor: C.border,
                }]}
                accessibilityLabel={`Bloque ${block.name}`}
              >
                <View style={[s.blockDot, { backgroundColor: block.color }]} />
                <TextInput
                  style={[s.blockNameInput, { color: C.text }]}
                  value={block.name}
                  onChangeText={v => builder.updateBlockName(block.localId, v)}
                  onFocus={() => builder.setSelectedBlockId(block.localId)}
                  accessibilityLabel="Nombre del bloque"
                />
                <View style={[s.blockCountBadge, { backgroundColor: block.color + '20' }]}>
                  <Text style={[s.blockCountText, { color: block.color }]}>
                    {block.exercises.length}
                  </Text>
                </View>
                <Text style={{ color: C.textSub, fontSize: 14, marginLeft: 4 }}>
                  {block.collapsed ? '›' : '⌃'}
                </Text>
                <TouchableOpacity
                  onPress={() => builder.removeBlock(block.localId)}
                  style={s.blockRemoveBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={`Eliminar bloque ${block.name}`}
                >
                  <Text style={{ color: C.error, fontSize: 13 }}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Contenido del bloque */}
              {!block.collapsed && (
                <>
                  {block.exercises.length === 0 ? (
                    <TouchableOpacity
                      style={[s.blockEmptyHint, {
                        borderLeftColor: block.color + '66',
                        borderBottomColor: C.border,
                        backgroundColor: block.color + '08',
                      }]}
                      onPress={() => {
                        builder.setSelectedBlockId(block.localId);
                        setBuilderTab('libreria');
                      }}
                    >
                      <Text style={[s.blockEmptyHintText, { color: block.color }]}>
                        + Toca para añadir ejercicios desde la librería
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    block.exercises.map(ex => (
                      <ExerciseCard
                        key={ex.localId}
                        ex={ex}
                        block={block}
                        C={C}
                        onUpdate={(field, v) => builder.updateExercise(block.localId, ex.localId, field, v)}
                        onRemove={() => builder.removeExercise(block.localId, ex.localId)}
                      />
                    ))
                  )}
                  {block.exercises.length > 0 && (
                    <TouchableOpacity
                      style={[s.addExBtn, {
                        borderColor: block.color + '55',
                        borderLeftColor: block.color,
                        backgroundColor: block.color + '06',
                      }]}
                      onPress={() => {
                        builder.setSelectedBlockId(block.localId);
                        setBuilderTab('libreria');
                      }}
                    >
                      <Text style={[s.addExBtnText, { color: block.color }]}>+ Añadir ejercicio</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          ))}

          <TouchableOpacity
            style={[s.addAnotherBlock, {
              borderColor: Colors.primary + '55',
              backgroundColor: Colors.primaryLight,
            }]}
            onPress={builder.addBlock}
          >
            <Text style={[s.addAnotherBlockText, { color: Colors.primary }]}>+ Añadir otro bloque</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  ), [builder, C, setBuilderTab]);

  const LibraryPanel = useCallback(() => (
    <View style={{ flex: 1 }}>
      {/* Banner de bloque activo */}
      <View style={[s.libBanner, {
        backgroundColor: builder.selectedBlock ? builder.selectedBlock.color + '12' : '#F59E0B12',
        borderBottomColor: builder.selectedBlock ? builder.selectedBlock.color + '33' : '#F59E0B33',
      }]}>
        {builder.selectedBlock ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.activeBlockDot, { backgroundColor: builder.selectedBlock.color }]} />
            <Text style={[s.libBannerText, { color: builder.selectedBlock.color }]}>
              Añadiendo a: <Text style={{ fontWeight: '700' }}>{builder.selectedBlock.name}</Text>
            </Text>
          </View>
        ) : (
          <Text style={[s.libBannerText, { color: '#F59E0B' }]}>⚠️ Selecciona un bloque primero</Text>
        )}
        {!IS_TABLET && (
          <TouchableOpacity onPress={() => setBuilderTab('bloques')}>
            <Text style={{ fontSize: 12, color: C.textSub }}>← Bloques</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Búsqueda */}
      <View style={[s.libSearchRow, { borderBottomColor: C.border, backgroundColor: C.bg }]}>
        <TextInput
          style={[s.libSearchInput, { color: C.text, borderColor: C.border, backgroundColor: C.surface }]}
          placeholder="Buscar ejercicio..."
          placeholderTextColor={C.textSub}
          value={librarySearch}
          onChangeText={setLibrarySearch}
        />
      </View>

      {/* Filtros de grupo muscular */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.libFilters}>
        {MUSCLE_GROUPS.map(g => (
          <TouchableOpacity
            key={g}
            style={[s.libChip, {
              backgroundColor: libraryFilter === g ? Colors.primary : C.surface,
              borderColor: libraryFilter === g ? Colors.primary : C.border,
            }]}
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
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <LibraryItem
              item={item}
              isAdded={builder.selectedBlock?.exercises.some(e => e.exerciseId === item.id) ?? false}
              isDisabled={!builder.selectedBlock}
              blockColor={builder.selectedBlock?.color ?? null}
              C={C}
              onPress={() => {
                if (!builder.selectedBlockId) {
                  Alert.alert('Selecciona un bloque', 'Primero crea o selecciona un bloque.');
                  return;
                }
                builder.addExerciseToBlock(builder.selectedBlockId, item);
              }}
            />
          )}
        />
      )}
    </View>
  ), [builder, C, librarySearch, libraryFilter, filteredLibrary]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.bg }]}>

      {/* ── Modal: nombre de nueva rutina ── */}
      <Modal visible={showNameModal} transparent animationType="slide" onRequestClose={() => setShowNameModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={s.modalOverlay} onPress={() => setShowNameModal(false)}>
            <Pressable onPress={e => e.stopPropagation()}>
              <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={s.modalTitleRow}>
                  <View style={s.modalTitleIcon}><Text style={{ fontSize: 18 }}>📋</Text></View>
                  <Text style={[s.modalTitle, { color: C.text }]}>Nueva rutina</Text>
                  <TouchableOpacity onPress={() => setShowNameModal(false)} style={s.modalClose}>
                    <Text style={{ color: C.textSub, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[s.modalSub, { color: C.textSub }]}>
                  Dale un nombre a tu rutina antes de empezar
                </Text>
                <TextInput
                  style={[s.nameInput, {
                    color: C.text,
                    borderColor: Colors.primary + '55',
                    backgroundColor: Colors.primaryLight + '55',
                  }]}
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
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: asignar rutina ── */}
      <Modal visible={showAssignModal} transparent animationType="slide" onRequestClose={() => setShowAssignModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={s.modalOverlay} onPress={() => setShowAssignModal(false)}>
            <Pressable onPress={e => e.stopPropagation()}>
              <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={s.modalTitleRow}>
                  <View style={s.modalTitleIcon}><Text style={{ fontSize: 18 }}>👤</Text></View>
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
                  <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                    {users.map(user => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <TouchableOpacity
                          key={user.id}
                          style={[s.assignRow, {
                            borderColor: isSelected ? Colors.primary : C.border,
                            backgroundColor: isSelected ? Colors.primaryLight : C.surface,
                          }]}
                          onPress={() => toggleUserId(user.id)}
                          accessibilityLabel={`Seleccionar a ${user.name}`}
                          accessibilityState={{ selected: isSelected }}
                        >
                          <View style={[s.userAvatar, {
                            backgroundColor: isSelected ? Colors.primary : Colors.primaryLight,
                          }]}>
                            <Text style={{ color: isSelected ? '#fff' : Colors.primary, fontWeight: '700', fontSize: 14 }}>
                              {user.name?.charAt(0).toUpperCase() ?? '?'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.assignName, { color: C.text }]}>{user.name || 'Sin nombre'}</Text>
                            <Text style={[s.assignSub, { color: C.textSub }]}>{user.email || 'Sin email'}</Text>
                          </View>
                          <View style={[s.checkCircle, {
                            backgroundColor: isSelected ? Colors.primary : C.border + '44',
                            borderWidth: isSelected ? 0 : 1,
                            borderColor: C.border,
                          }]}>
                            {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
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
                  placeholder="Fecha (AAAA-MM-DD)"
                  placeholderTextColor={C.textSub}
                  value={assignDate}
                  onChangeText={setAssignDate}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />

                <TouchableOpacity
                  style={[s.btnPrimary, {
                    opacity: selectedUserIds.length > 0 && assignDate.length === 10 && !assigning ? 1 : 0.5,
                  }]}
                  onPress={confirmAssign}
                  disabled={selectedUserIds.length === 0 || assignDate.length < 10 || assigning}
                >
                  {assigning
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={s.btnPrimaryText}>Asignar rutina</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: ver asignaciones ── */}
      <Modal visible={showAssignmentsModal} transparent animationType="slide" onRequestClose={() => setShowAssignmentsModal(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowAssignmentsModal(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={[s.modalCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={s.modalTitleRow}>
                <View style={s.modalTitleIcon}><Text style={{ fontSize: 18 }}>📅</Text></View>
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
                    <View key={a.id} style={[s.assignmentRow, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
                      <View style={[s.userAvatar, { backgroundColor: Colors.primaryLight }]}>
                        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700' }}>
                          #{a.assigned_to_id}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
                          Usuario #{a.assigned_to_id}
                        </Text>
                        <Text style={{ color: C.textSub, fontSize: 12, marginTop: 2 }}>{a.date}</Text>
                        {a.note && (
                          <Text style={{ color: C.textSub, fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                            {a.note}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={s.deleteAssignBtn}
                        onPress={() => handleDeleteAssignment(a.id)}
                        accessibilityLabel="Eliminar asignación"
                      >
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ════════════════════════════════════════════════════
          MODO BUILDER
      ════════════════════════════════════════════════════ */}
      {mode === 'builder' ? (
        <View style={{ flex: 1 }}>
          {/* Topbar del builder */}
          <View style={[s.builderTopbar, { borderBottomColor: C.border, backgroundColor: Colors.primary }]}>
            <TouchableOpacity style={s.builderBackBtn} onPress={exitBuilder}>
              <Text style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: '500' }}>← Volver</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.builderTopbarTitle} numberOfLines={1}>{builder.routineName}</Text>
              <Text style={s.builderTopbarSub}>
                {builder.blocks.length} bloques · {builder.totalExercises} ejercicios
              </Text>
            </View>
            <TouchableOpacity
              style={[s.builderSaveBtn, { backgroundColor: Colors.primaryDark }]}
              onPress={saveRoutine}
              disabled={saving}
              accessibilityLabel={builder.editingRoutineId ? 'Actualizar rutina' : 'Guardar rutina'}
            >
              {saving
                ? <ActivityIndicator color={Colors.primaryLight} size="small" />
                : <Text style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: '700' }}>
                    {builder.editingRoutineId ? 'Actualizar' : 'Guardar'}
                  </Text>}
            </TouchableOpacity>
          </View>

          {/* Tab bar (solo móvil) */}
          {!IS_TABLET && (
            <View style={[s.tabBar, { borderBottomColor: C.border, backgroundColor: C.surface }]}>
              {(['bloques', 'libreria'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[s.tab, builderTab === tab && { borderBottomWidth: 2, borderBottomColor: Colors.primary }]}
                  onPress={() => setBuilderTab(tab)}
                >
                  <Text style={[s.tabText, { color: builderTab === tab ? Colors.primary : C.textSub }]}>
                    {tab === 'bloques' ? `📋 Bloques (${builder.blocks.length})` : '💪 Librería'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {IS_TABLET ? (
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
          {/* Cabecera */}
          <View style={[s.pageHeader, { backgroundColor: C.bg }]}>
            <View>
              <Text style={[s.pageTitle, { color: C.text }]}>Rutinas</Text>
              <Text style={[s.pageSub, { color: C.textSub }]}>{routines.length} disponibles</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                style={[s.logoutBtn, { borderColor: C.border }]}
                onPress={async () => { await deleteToken(); router.replace('/auth/login'); }}
                accessibilityLabel="Cerrar sesión"
              >
                <Text style={[s.logoutText, { color: C.textSub }]}>↪ Salir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.createBtn} onPress={openBuilder} accessibilityLabel="Crear nueva rutina">
                <Text style={s.createBtnText}>+ Crear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero con stats */}
          <View style={s.hero}>
            <View style={s.heroStats}>
              <StatBadge icon="🗓" value={routines.length} label="Rutinas" />
              <View style={s.heroStatDivider} />
              <StatBadge icon="🏋️" value={totalExercisesInRoutines} label="Ejercicios" />
              <View style={s.heroStatDivider} />
              <StatBadge icon="👥" value={users.length} label="Usuarios" />
            </View>
          </View>

          {/* Buscador */}
          <View style={[s.searchWrapper, { backgroundColor: C.bg }]}>
            <View style={[s.searchBox, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput
                style={[s.searchInput, { color: C.text }]}
                placeholder="Buscar rutinas..."
                placeholderTextColor={C.textSub}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity
              style={[s.filterIconBox, { backgroundColor: C.surface, borderColor: C.border }]}
              accessibilityLabel="Filtros"
            >
              <Text style={{ fontSize: 16 }}>⚙️</Text>
            </TouchableOpacity>
          </View>

          {/* Contenido principal */}
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={{ color: C.textSub, marginTop: 12 }}>Cargando rutinas...</Text>
            </View>
          ) : filteredRoutines.length === 0 ? (
            <EmptyState onPress={openBuilder} />
          ) : (
            <FlatList
              data={filteredRoutines}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 14 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: routine }) => (
                <RoutineCard
                  routine={routine}
                  onAssign={() => openAssignModal(routine)}
                  onViewAssignments={() => openAssignmentsModal(routine)}
                  onEdit={() => openEditRoutine(routine)}
                  onDelete={() => handleDeleteRoutine(routine)}
                />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Page header
  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  pageSub: { fontSize: 13, marginTop: 2, fontWeight: '500' },
  logoutBtn: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  logoutText: { fontSize: 13, fontWeight: '600' },
  createBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12 },
  createBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Hero
  hero: {
    backgroundColor: Colors.primary, marginHorizontal: 16,
    borderRadius: 18, padding: 16, marginBottom: 14,
  },
  heroStats: { flexDirection: 'row', alignItems: 'center' },
  heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  heroStatIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  heroStatIconText: { fontSize: 18 },
  heroStatTexts: { alignItems: 'flex-start' },
  heroStatVal: { fontSize: 22, fontWeight: '800', color: '#EAF3DE', lineHeight: 26 },
  heroStatLbl: { fontSize: 11, color: '#A8D060', fontWeight: '500', marginTop: 1 },
  heroStatDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },

  // Búsqueda
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, marginBottom: 6,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '400' },
  filterIconBox: {
    width: 46, height: 46, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Routine card
  routineCard: {
    borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF',
    shadowColor: '#3B6D11', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  cardBg: { width: '100%' },
  cardBgImage: { borderRadius: 18, opacity: 1 },
  menuDotsBtn: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'column', gap: 3, padding: 6, zIndex: 2,
  },
  menuDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#94A3B8' },
  blockIndicators: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14,
  },
  blockIndicatorDot: { width: 8, height: 8, borderRadius: 4 },
  blockIndicatorMore: { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginLeft: 2 },
  cardBody: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, paddingRight: 40 },
  routineCardName: { fontSize: 20, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.2, marginBottom: 3 },
  routineCardSub: { fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 12 },

  // Pills ejercicios en card
  exercisesPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  exPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  exPillText: { fontSize: 11, fontWeight: '600' },

  // Footer de la card
  routineCardFooter: { flexDirection: 'row', borderTopWidth: 1, backgroundColor: 'rgba(255,255,255,0.7)' },
  footerBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  footerBtnText: { fontSize: 12, fontWeight: '700' },
  footerDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.07)', marginVertical: 8 },

  // Builder
  builderTopbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  builderBackBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primaryDark },
  builderTopbarTitle: { fontSize: 15, fontWeight: '700', color: '#EAF3DE' },
  builderTopbarSub: { fontSize: 11, color: '#97C459', marginTop: 1 },
  builderSaveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  builderMain: { flex: 1, flexDirection: 'row' },
  panelLeft: { flex: 1, borderRightWidth: 0.5 },
  panelRight: { width: 300 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  tabText: { fontSize: 13, fontWeight: '500' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: '#1A1A1A' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyAddBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  emptyAddText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Blocks builder
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 13, borderLeftWidth: 4, borderBottomWidth: 0.5 },
  blockDot: { width: 8, height: 8, borderRadius: 4 },
  blockNameInput: { flex: 1, fontSize: 14, fontWeight: '700', padding: 0 },
  blockCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  blockCountText: { fontSize: 12, fontWeight: '700' },
  blockRemoveBtn: { padding: 6 },
  blockEmptyHint: { paddingHorizontal: 20, paddingVertical: 14, borderLeftWidth: 4, borderBottomWidth: 0.5 },
  blockEmptyHintText: { fontSize: 13, fontWeight: '500' },
  exCard: { marginHorizontal: 12, marginVertical: 5, borderRadius: 12, borderWidth: 0.5, borderLeftWidth: 4, padding: 12 },
  exCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  exCardName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  exRemoveBtn: { padding: 6, marginTop: -2 },
  muscleBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  muscleBadgeText: { fontSize: 11, fontWeight: '600' },
  exCardStats: { flexDirection: 'row', gap: 6 },
  exStat: { flex: 1, alignItems: 'center', borderRadius: 8, borderWidth: 0.5, padding: 6 },
  exStatLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  exStatInput: { width: '100%', fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 0 },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderLeftWidth: 4 },
  addExBtnText: { fontSize: 13, fontWeight: '500' },
  addAnotherBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' },
  addAnotherBlockText: { fontSize: 14, fontWeight: '600' },

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
  libThumb: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  libName: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  libTag: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  libTagText: { fontSize: 10, fontWeight: '600' },
  libDesc: { fontSize: 11, marginTop: 3 },
  libAddCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 0.5, padding: 24, paddingBottom: 44 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  modalTitleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  modalClose: { padding: 4 },
  modalSub: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  nameInput: { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 4 },
  noteInput: { borderWidth: 0.5, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 4, minHeight: 48, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnCancel: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5 },
  btnCancelText: { fontSize: 14, fontWeight: '500' },
  btnPrimary: { backgroundColor: Colors.primary, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Assign modal
  assignBadge: { backgroundColor: Colors.primaryLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14 },
  assignBadgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  userAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  assignName: { fontSize: 14, fontWeight: '600' },
  assignSub: { fontSize: 12, marginTop: 2 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, borderBottomWidth: 0.5, marginBottom: 4 },
  deleteAssignBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#FEF2F2' },
});