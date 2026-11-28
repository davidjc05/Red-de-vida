import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { createExercise, updateExercise } from '../../services/api';
import { notify } from '../../services/ui';
import { G, FC, FB, FBB, MUSCLE_GROUPS, EMPTY_FORM } from './shared';
import type { Exercise } from './shared';

// Formulario para CREAR un ejercicio nuevo (mode="create") o EDITAR uno existente (mode="edit").
// Es el mismo formulario para los dos casos: si añades un campo, solo hay que tocarlo aquí.

const TEXTS = {
  create: { title: 'Nuevo ejercicio', descPlaceholder: 'Explica la ejecución del ejercicio...', save: 'GUARDAR EJERCICIO', errorTitle: 'Error al guardar' },
  edit:   { title: 'Editar ejercicio', descPlaceholder: 'Explica la ejecución...',                save: 'GUARDAR CAMBIOS',   errorTitle: 'Error' },
};

interface Props {
  mode: 'create' | 'edit';
  visible: boolean;
  exercise?: Exercise | null; // solo en modo "edit": el ejercicio a editar
  onClose: () => void;
  onSaved: () => void;        // se llama tras guardar bien (la pantalla recarga la lista)
}

export default function ExerciseFormModal({ mode, visible, exercise = null, onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const t = TEXTS[mode];

  // Cada vez que se abre: vacío para crear, con los datos del ejercicio para editar.
  useEffect(() => {
    if (!visible) return;
    setForm(mode === 'edit' && exercise ? {
      name:         exercise.name,
      muscle_group: exercise.muscle_group,
      description:  exercise.description ?? '',
      image_url:    exercise.image_url   ?? '',
      video_url:    exercise.video_url   ?? '',
    } : EMPTY_FORM);
  }, [visible, mode, exercise]);

  if (mode === 'edit' && !exercise) return null;

  const handleSave = async () => {
    if (!form.name.trim()) { notify('Error', 'El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      if (mode === 'edit' && exercise) {
        // al editar, un campo vacío se envía como null para borrar el dato
        await updateExercise(exercise.id, {
          name:         form.name.trim(),
          muscle_group: form.muscle_group,
          description:  form.description.trim() || null,
          image_url:    form.image_url.trim()   || null,
          video_url:    form.video_url.trim()   || null,
        });
      } else {
        await createExercise({
          name:         form.name.trim(),
          muscle_group: form.muscle_group,
          description:  form.description.trim() || undefined,
          image_url:    form.image_url.trim()   || undefined,
          video_url:    form.video_url.trim()   || undefined,
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      notify(t.errorTitle, e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalAccentBar} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t.title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
                <Text style={{ fontSize: 20, color: G.textHint }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Nombre *</Text>
            <TextInput style={s.input} placeholder="Ej: Press de banca" placeholderTextColor={G.textHint}
              value={form.name} onChangeText={v => setForm({ ...form, name: v })} autoFocus />

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
            <TextInput style={[s.input, s.inputMultiline]} placeholder={t.descPlaceholder}
              placeholderTextColor={G.textHint} multiline numberOfLines={3}
              value={form.description} onChangeText={v => setForm({ ...form, description: v })} />

            <Text style={s.inputLabel}>URL imagen (opcional)</Text>
            <TextInput style={s.input} placeholder="https://..." placeholderTextColor={G.textHint}
              value={form.image_url} onChangeText={v => setForm({ ...form, image_url: v })}
              keyboardType="url" autoCapitalize="none" />

            <Text style={s.inputLabel}>URL vídeo / YouTube (opcional)</Text>
            <TextInput style={s.input} placeholder="https://youtube.com/..." placeholderTextColor={G.textHint}
              value={form.video_url} onChangeText={v => setForm({ ...form, video_url: v })}
              keyboardType="url" autoCapitalize="none" />

            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnCancel} onPress={onClose}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnSave, { opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={G.white} />
                  : <Text style={s.btnSaveText}>{t.save}</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: G.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 44,
    maxHeight: '88%',
    overflow: 'hidden',
  },

  modalAccentBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: G.border,
    marginTop: 10,
    marginBottom: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 28,
    color: G.textMain,
    fontFamily: FC,
  },

  inputLabel: {
    fontSize: 13,
    color: G.textSub,
    fontFamily: FBB,
    marginBottom: 6,
    marginTop: 2,
  },

  input: {
    backgroundColor: G.white,
    borderWidth: 1,
    borderColor: G.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FB,
    color: G.textMain,
    marginBottom: 16,
  },

  inputMultiline: {
    height: 92,
    textAlignVertical: 'top',
  },

  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },

  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: G.border,
    backgroundColor: G.white,
  },

  modalChipActive: {
    backgroundColor: G.primaryDark,
    borderColor: G.primaryDark,
  },

  modalChipText: {
    fontSize: 13,
    color: G.textSub,
    fontFamily: FBB,
  },

  modalChipTextActive: {
    color: G.white,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },

  btnCancel: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: G.border,
    justifyContent: 'center',
  },

  btnCancelText: {
    fontSize: 14,
    color: G.textMain,
    fontFamily: FBB,
  },

  btnSave: {
    flex: 1,
    backgroundColor: G.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnSaveText: {
    color: G.white,
    fontSize: 17,
    letterSpacing: 0.5,
    fontFamily: FC,
  },
});
