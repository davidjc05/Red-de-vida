import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { getExercises, deleteExercise, getRole } from '../../services/api';
import { notify, confirmAction } from '../../services/ui';
import ExerciseCard from '../../components/exercises/ExerciseCard';
import ExerciseDetailModal from '../../components/exercises/ExerciseDetailModal';
import ExerciseFormModal from '../../components/exercises/ExerciseFormModal';
import { G, FC, FB, FBB, MUSCLE_GROUPS } from '../../components/exercises/shared';
import type { Exercise } from '../../components/exercises/shared';

export default function ExercisesScreen() {
  const [exercises, setExercises]         = useState<Exercise[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState('Todos');
  const [search, setSearch]               = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [editExercise, setEditExercise]   = useState<Exercise | null>(null);
  const [isAdmin, setIsAdmin]             = useState<boolean | null>(null);

  const load = useCallback(async (group: string) => {
    setLoading(true);
    try {
      const data = await getExercises(group === 'Todos' ? undefined : group);
      setExercises(data);
    } catch (e: any) {
      notify('Error cargando ejercicios', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('Todos');
    getRole().then(role => {
      setIsAdmin(role?.toLowerCase().trim() === 'admin');
    });
  }, []);

  const handleFilterChange = (group: string) => { setFilter(group); load(group); };

  const handleDelete = async (exercise: Exercise) => {
    const borrar = async () => {
      try {
        await deleteExercise(exercise.id);

        await load(filter);
      } catch (e: any) {
        notify("Error", e.message);
      }
    };

    confirmAction(
      'Eliminar ejercicio',
      `¿Seguro que quieres eliminar "${exercise.name}"? También desaparecerá de las rutinas que lo usen.`,
      'Eliminar',
      borrar,
      true,
    );
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
      <ExerciseFormModal
        mode="edit"
        visible={!!editExercise}
        exercise={editExercise}
        onClose={() => setEditExercise(null)}
        onSaved={() => load(filter)}
      />

      {/* Modal creación (solo admin) */}
      <ExerciseFormModal
        mode="create"
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSaved={() => load(filter)}
      />
    </SafeAreaView>
  );
}


const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: G.bgPage,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 10,
  },

  loadingText: {
    color: G.textSub,
    fontSize: 14,
    fontFamily: FB,
    marginTop: 8,
  },

  emptyTitle: {
    fontSize: 26,
    color: G.textMain,
    textAlign: 'center',
    fontFamily: FC,
  },

  emptySub: {
    fontSize: 14,
    color: G.textSub,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: FB,
  },

  adminHint: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
  },

  adminHintText: {
    fontSize: 12,
    color: G.textSub,
    fontFamily: FB,
  },

  header: {
    backgroundColor: G.bgPage,

    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,

    zIndex: 1,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: G.primary,
    fontFamily: FBB,
    marginBottom: 2,
  },

  headerTitle: {
    fontSize: 34,
    color: G.textMain,
    lineHeight: 36,
    letterSpacing: -0.3,
    fontFamily: FC,
  },

  headerSub: {
    fontSize: 13,
    color: G.textSub,
    fontFamily: FB,
    marginTop: 4,
  },

  addBtn: {
    backgroundColor: G.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 4,
  },

  addBtnText: {
    fontSize: 16,
    color: G.white,
    letterSpacing: 0.5,
    fontFamily: FC,
  },

  searchInput: {
    backgroundColor: G.white,
    borderWidth: 1,
    borderColor: G.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FB,
    color: G.textMain,
  },

  chipsContainer: {
    backgroundColor: 'transparent',
    flexGrow: 0,
    marginTop: 8,
    minHeight: 56,
    zIndex: 20,
    elevation: 20,
    overflow: 'visible',
  },

  chipsRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: G.border,
    backgroundColor: G.white,
  },

  chipActive: {
    backgroundColor: G.primaryDark,
    borderColor: G.primaryDark,
  },

  chipText: {
    fontSize: 13,
    color: G.textSub,
    fontFamily: FBB,
  },

  chipTextActive: {
    color: G.white,
  },

  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
});
